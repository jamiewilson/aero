import type { AeroOptions, AliasResult } from '../types'
import type { Plugin, PluginOption, ResolvedConfig } from 'vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { nitro } from 'nitro/vite'

import {
	CLIENT_SCRIPT_PREFIX,
	DEFAULT_API_PREFIX,
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	resolveDirs,
	RUNTIME_INSTANCE_MODULE_ID,
} from './defaults'

import { parse } from '../compiler/parser'
import { compile } from '../compiler/codegen'
import { resolvePageName } from '../utils/routing'
import { loadTsconfigAliases } from '../utils/aliases'
import { createBuildConfig, renderStaticPages } from './build'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'path'

async function runNitroBuild(root: string): Promise<void> {
	const nitroBin = process.platform === 'win32' ? 'nitro.cmd' : 'nitro'
	await new Promise<void>((resolve, reject) => {
		const child = spawn(nitroBin, ['build'], {
			cwd: root,
			stdio: 'inherit',
			env: process.env,
		})

		child.on('error', reject)
		child.on('exit', code => {
			if (code === 0) {
				resolve()
				return
			}
			reject(new Error(`[aero] nitro build failed with exit code ${code ?? 'null'}`))
		})
	})
}

export function aero(options: AeroOptions = {}): PluginOption[] {
	const clientScripts = new Map<string, string>()
	const runtimeInstanceJsPath = fileURLToPath(
		new URL('../runtime/instance.js', import.meta.url),
	)
	const runtimeInstanceTsPath = fileURLToPath(
		new URL('../runtime/instance.ts', import.meta.url),
	)
	const runtimeInstancePath = existsSync(runtimeInstanceJsPath)
		? runtimeInstanceJsPath
		: runtimeInstanceTsPath
	let config: ResolvedConfig
	let aliasResult: AliasResult
	const dirs = resolveDirs(options.dirs)
	const apiPrefix = options.apiPrefix || DEFAULT_API_PREFIX
	// Allow temporary opt-out (e.g. static-only local checks) without changing config.
	const enableNitro = options.nitro === true && process.env.AERO_NITRO !== 'false'

	const mainPlugin: Plugin = {
		name: 'vite-plugin-aero',

		config(userConfig) {
			const root = userConfig.root || process.cwd()
			aliasResult = loadTsconfigAliases(root)

			return {
				base: './',
				resolve: { alias: aliasResult.aliases },
				build: createBuildConfig(
					{ resolvePath: aliasResult.resolvePath, dirs: options.dirs },
					root,
				),
			}
		},

		configResolved(resolvedConfig) {
			config = resolvedConfig
		},

		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url) return next()
				if (req.method && req.method.toUpperCase() !== 'GET') return next()

				const acceptsHtml = req.headers.accept?.includes('text/html')
				if (!acceptsHtml) return next()

				const pathname = req.url.split('?')[0] || '/'
				// Bypass API and Vite internals
				if (
					pathname.startsWith(apiPrefix) ||
					pathname.startsWith('/@fs') ||
					pathname.startsWith('/@id')
				) {
					return next()
				}

				const ext = path.extname(pathname)
				// Skip asset requests
				if (ext && ext !== '.html') return next()

				try {
					const pageName = resolvePageName(req.url)
					const mod = await server.ssrLoadModule(RUNTIME_INSTANCE_MODULE_ID)

					const requestUrl = new URL(req.url, 'http://localhost')
					const requestHeaders = new Headers()
					for (const [name, value] of Object.entries(req.headers)) {
						if (value === undefined) continue
						if (Array.isArray(value)) {
							for (const item of value) requestHeaders.append(name, item)
							continue
						}
						requestHeaders.set(name, value)
					}

					const renderInput = {
						url: requestUrl,
						request: new Request(requestUrl.toString(), {
							method: req.method || 'GET',
							headers: requestHeaders,
						}),
						routePath: pathname,
					}

					let rendered = await mod.aero.render(pageName, renderInput)

					// If the page was not found, render the 404 page instead.
					if (rendered === null) {
						res.statusCode = 404
						rendered = await mod.aero.render('404', renderInput)
					}

					// If even the 404 page doesn't exist, send a plain response.
					if (rendered === null) {
						res.statusCode = 404
						res.setHeader('Content-Type', 'text/html; charset=utf-8')
						res.end('<h1>404 — Not Found</h1>')
						return
					}

					if (!/^\s*<!doctype\s+html/i.test(rendered)) {
						rendered = `<!doctype html>\n${rendered}`
					}

					const transformed = await server.transformIndexHtml(req.url, rendered)
					res.setHeader('Content-Type', 'text/html; charset=utf-8')
					res.end(transformed)
				} catch (err) {
					next(err)
				}
			})
		},

		async resolveId(id, importer) {
			if (id === RUNTIME_INSTANCE_MODULE_ID) {
				return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
			}

			if (id.startsWith(CLIENT_SCRIPT_PREFIX)) {
				return '\0' + id
			}

			// Let the content plugin handle its own virtual modules
			if (id.startsWith('aero:content')) {
				return null
			}

			// 1. Try resolving the ID as-is (handles standard aliases and relative paths)
			const resolved = await this.resolve(id, importer, { skipSelf: true })
			if (resolved && resolved.id.endsWith('.html')) {
				return resolved
			}

			// 2. If it's a template import without .html extension (e.g. @src/layouts/base)
			// we try to resolve it with the extension appended.
			if (!id.includes('.') && !id.startsWith('\0')) {
				const resolvedHtml = await this.resolve(id + '.html', importer, { skipSelf: true })

				if (resolvedHtml) {
					return resolvedHtml
				}
			}

			return null
		},

		load(id) {
			if (id === RESOLVED_RUNTIME_INSTANCE_MODULE_ID) {
				return `export { aero, onUpdate } from ${JSON.stringify(runtimeInstancePath)}`
			}

			// Handle virtual client scripts (prefixed with \0 from resolveId)
			if (id.startsWith('\0' + CLIENT_SCRIPT_PREFIX)) {
				const virtualId = id.slice(1) // Remove \0 prefix to get the map key
				const content = clientScripts.get(virtualId)
				return content ?? ''
			}
			return null
		},

		transform(code, id) {
			// Only process .html files (resolved absolute paths)
			if (!id.endsWith('.html')) return null

			try {
				const parsed = parse(code)

				let clientScriptUrl: string | undefined
				if (parsed.clientScript) {
					const relativePath = path.relative(config.root, id).replace(/\\/g, '/')
					clientScriptUrl = CLIENT_SCRIPT_PREFIX + relativePath.replace(/\.html$/i, '.js')
					clientScripts.set(clientScriptUrl, parsed.clientScript.content)
				}

				const generated = compile(parsed, {
					root: config.root,
					clientScriptUrl,
					resolvePath: aliasResult.resolvePath,
				})

				return {
					code: generated,
					map: null,
				}
			} catch (err: any) {
				const relativePath = path.relative(config.root, id)
				this.error(`[aero] Error compiling ${relativePath}: ${err.message}`)
			}
		},

		handleHotUpdate({ file, server, modules }) {
			const contentDir = path.resolve(config.root, dirs.client, 'content')
			if (file.startsWith(contentDir) && file.endsWith('.ts')) {
				const instanceModule = server.moduleGraph.getModuleById(
					RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
				)
				if (instanceModule) {
					server.moduleGraph.invalidateModule(instanceModule)
					return [...modules, instanceModule]
				}
			}
			return modules
		},
	}

	const staticBuildPlugin: Plugin = {
		name: 'vite-plugin-aero-static',
		apply: 'build',
		async closeBundle() {
			const root = config.root
			const outDir = config.build.outDir
			// Read minify from Vite's build.minify config
			// If user sets vite.build.minify = false, disable both Vite minification AND HTML minification
			const shouldMinifyHtml = config.build.minify !== false && process.env.NODE_ENV === 'production'
			await renderStaticPages(
				{
					root,
					resolvePath: aliasResult.resolvePath,
					dirs: options.dirs,
					apiPrefix,
					configFile: config.configFile,
					// Keep static rendering isolated from user vite.config.ts while
					// still providing Aero's HTML transform/runtime resolution support.
					vitePlugins: config.configFile ? [] : [mainPlugin],
					minify: shouldMinifyHtml,
				},
				outDir,
			)
			if (enableNitro) {
				await runNitroBuild(root)
			}
		},
	}

	const plugins: PluginOption[] = [
		mainPlugin,
		staticBuildPlugin,
		ViteImageOptimizer({
			exclude: undefined,
			include: undefined,
			includePublic: true,
			logStats: true,
			ansiColors: true,
			svg: {
				multipass: true,
				plugins: [
					{
						name: 'preset-default',
						params: {
							overrides: {
								cleanupNumericValues: false,
							},
							cleanupIDs: {
								minify: false,
								remove: false,
							},
							convertPathData: false,
						},
					},
				],
			},
			png: { quality: 80 },
			jpeg: { quality: 80 },
			jpg: { quality: 80 },
			tiff: { quality: 80 },
			gif: {},
			webp: { lossless: true },
			avif: { lossless: true },
		}),
	]

	// Nitro Vite integration is serve-only; build orchestration is handled above.
	if (enableNitro) {
		const rawNitroPlugins = nitro({ serverDir: dirs.server })
		const nitroPlugins = Array.isArray(rawNitroPlugins) ? rawNitroPlugins : [rawNitroPlugins]
		for (const nitro of nitroPlugins) {
			if (!nitro || typeof nitro !== 'object') continue
			const originalApply = nitro.apply
			plugins.push({
				...nitro,
				apply(pluginConfig, env) {
					if (env.command !== 'serve') return false
					if ((env as { isPreview?: boolean }).isPreview) return false
					if (typeof originalApply === 'function') {
						return originalApply(pluginConfig, env)
					}
					if (originalApply) return originalApply === 'serve'
					return true
				},
			})
		}
	}

	return plugins
}
