/**
 * Aero Vite plugin: HTML transform, virtual modules, dev server middleware, and static build.
 *
 * @remarks
 * Split into focused sub-plugins: config, virtuals (resolve/load), transform, SSR middleware, HMR.
 * Static build plugin runs after closeBundle; Nitro and image optimizer are composed in the factory.
 */

import type {
	AeroMiddlewareResult,
	AeroOptions,
	AliasResult,
	AeroRenderInput,
	ScriptEntry,
} from '../types'
import { extractObjectKeys } from '../compiler/helpers'
import type { Plugin, PluginOption, ResolvedConfig } from 'vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { nitro } from 'nitro/vite'

import {
	CLIENT_SCRIPT_PREFIX,
	DEFAULT_API_PREFIX,
	getClientScriptVirtualUrl,
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	resolveDirs,
	RUNTIME_INSTANCE_MODULE_ID,
} from './defaults'

import { parse } from '../compiler/parser'
import { compile } from '../compiler/codegen'
import { resolvePageName } from '../utils/routing'
import { loadTsconfigAliases } from '../utils/aliases'
import { createBuildConfig, discoverClientScriptContentMap, renderStaticPages } from './build'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'path'

/** Shared state used by the Aero sub-plugins (config, virtuals, transform, ssr, hmr). */
interface AeroPluginState {
	config: ResolvedConfig | null
	aliasResult: AliasResult | null
	clientScripts: Map<string, ScriptEntry>
	runtimeInstancePath: string
	dirs: ReturnType<typeof resolveDirs>
	apiPrefix: string
	options: AeroOptions
}

/** Run `nitro build` in root; used after static pages are written when options.nitro is true. */
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

function createAeroConfigPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-config',
		enforce: 'pre',
		config(userConfig) {
			const root = userConfig.root || process.cwd()
			state.aliasResult = loadTsconfigAliases(root)
			const site = state.options.site ?? ''

			return {
				base: './',
				resolve: { alias: state.aliasResult.aliases },
				define: {
					'import.meta.env.SITE': JSON.stringify(site),
				},
				build: createBuildConfig(
					{ resolvePath: state.aliasResult.resolvePath, dirs: state.options.dirs },
					root,
				),
			}
		},
		configResolved(resolvedConfig) {
			state.config = resolvedConfig
		},
	}
}

function createAeroVirtualsPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-virtuals',
		enforce: 'pre',
		buildStart() {
			if (!state.config) return
			const contentMap = discoverClientScriptContentMap(state.config.root, state.dirs.client)
			contentMap.forEach((entry, url) => state.clientScripts.set(url, entry))
		},
		async resolveId(id, importer) {
			if (id === RUNTIME_INSTANCE_MODULE_ID) {
				return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
			}

			if (id.startsWith(CLIENT_SCRIPT_PREFIX)) {
				return '\0' + id
			}

			if (id.startsWith('aero:content')) {
				return null
			}

			const resolved = await this.resolve(id, importer, { skipSelf: true })
			if (resolved && resolved.id.endsWith('.html')) {
				return resolved
			}

			// Only try id + '.html' for path-like specifiers (relative, absolute, or path aliases like @components/foo).
			// Skip bare packages (nitro, nitro/app) and scoped packages (@aero-ssg/content/render).
			const isPathLike =
				id.startsWith('./') ||
				id.startsWith('../') ||
				id.startsWith('/') ||
				(id.startsWith('@') && !id.slice(1).split('/')[0].includes('-'))
			if (isPathLike && !id.includes('.') && !id.startsWith('\0')) {
				const resolvedHtml = await this.resolve(id + '.html', importer, { skipSelf: true })
				if (resolvedHtml) {
					return resolvedHtml
				}
			}

			return null
		},
		load(id) {
			if (id === RESOLVED_RUNTIME_INSTANCE_MODULE_ID) {
				return `export { aero, onUpdate } from ${JSON.stringify(state.runtimeInstancePath)}`
			}

			if (id.startsWith('\0' + CLIENT_SCRIPT_PREFIX)) {
				const virtualId = id.slice(1)
				const entry = state.clientScripts.get(virtualId)
				if (!entry) return ''

				if (entry.passDataExpr) {
					const keys = extractObjectKeys(entry.passDataExpr)
					if (keys.length > 0) {
						const preamble =
							`var __aero_data=(typeof window!=='undefined'&&window.__aero_data_next!==undefined)?window.__aero_data_next:{};if(typeof window!=='undefined')delete window.__aero_data_next;const { ${keys.join(', ')} } = __aero_data;\n`
						return preamble + entry.content
					}
				}

				return entry.content
			}
			return null
		},
	}
}

function createAeroTransformPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-transform',
		enforce: 'pre',
		transform(code, id) {
			if (!id.endsWith('.html')) return null
			if (!state.config || !state.aliasResult) return null

			try {
				const parsed = parse(code)

				if (parsed.clientScripts.length > 0) {
					const relativePath = path.relative(state.config.root, id).replace(/\\/g, '/')
					const baseName = relativePath.replace(/\.html$/i, '')
					const total = parsed.clientScripts.length

					for (let i = 0; i < total; i++) {
						const clientScript = parsed.clientScripts[i]
						const clientScriptUrl = getClientScriptVirtualUrl(baseName, i, total)

						state.clientScripts.set(clientScriptUrl, {
							content: clientScript.content,
							passDataExpr: clientScript.passDataExpr,
						})

						clientScript.content = clientScriptUrl
					}
				}

				const generated = compile(parsed, {
					root: state.config.root,
					clientScripts: parsed.clientScripts,
					blockingScripts: parsed.blockingScripts,
					inlineScripts: parsed.inlineScripts,
					resolvePath: state.aliasResult.resolvePath,
				})

				return {
					code: generated,
					map: null,
				}
			} catch (err: any) {
				const relativePath = path.relative(state.config.root, id)
				this.error(`[aero] Error compiling ${relativePath}: ${err.message}`)
			}
		},
	}
}

function createAeroSsrPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-ssr',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url) return next()
				if (req.method && req.method.toUpperCase() !== 'GET') return next()

				const acceptsHtml = req.headers.accept?.includes('text/html')
				if (!acceptsHtml) return next()

				const pathname = req.url.split('?')[0] || '/'
				if (
					pathname.startsWith(state.apiPrefix) ||
					pathname.startsWith('/@fs') ||
					pathname.startsWith('/@id')
				) {
					return next()
				}

				const ext = path.extname(pathname)
				if (ext && ext !== '.html') return next()

				// Apply config redirects first (exact path match)
				const redirects = state.options.redirects
				if (redirects?.length) {
					for (const rule of redirects) {
						if (pathname === rule.from) {
							res.statusCode = rule.status ?? 302
							res.setHeader('Location', rule.to)
							res.end()
							return
						}
					}
				}

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

					const request = new Request(requestUrl.toString(), {
						method: req.method || 'GET',
						headers: requestHeaders,
					})

					let renderPageName = pageName
					let renderInput: AeroRenderInput = {
						url: requestUrl,
						request,
						routePath: pathname,
						site: state.options.site,
					}

					// Run middleware (redirects, rewrites, custom response)
					const middleware = state.options.middleware
					if (middleware?.length) {
						const ctx = {
							url: requestUrl,
							request,
							routePath: pathname,
							pageName,
							site: state.options.site,
						}
						for (const handler of middleware) {
							const result: AeroMiddlewareResult = await Promise.resolve(
								handler(ctx),
							)
							if (result && 'redirect' in result) {
								res.statusCode = result.redirect.status ?? 302
								res.setHeader('Location', result.redirect.url)
								res.end()
								return
							}
							if (result && 'response' in result) {
								res.statusCode = result.response.status
								result.response.headers.forEach(
									(v: string, k: string) => res.setHeader(k, v),
								)
								const body = await result.response.arrayBuffer()
								res.end(Buffer.from(body))
								return
							}
							if (result && 'rewrite' in result) {
								if (result.rewrite.pageName !== undefined)
									renderPageName = result.rewrite.pageName
								const { pageName: _pn, ...rest } = result.rewrite
								renderInput = { ...renderInput, ...rest }
							}
						}
					}

					let rendered = await mod.aero.render(renderPageName, renderInput)

					if (rendered === null) {
						res.statusCode = 404
						rendered = await mod.aero.render('404', renderInput)
					}

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
	}
}

function createAeroHmrPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-hmr',
		handleHotUpdate({ file, server, modules }) {
			if (!state.config) return modules

			const contentDir = path.resolve(state.config.root, state.dirs.client, 'content')
			if (file.startsWith(contentDir) && file.endsWith('.ts')) {
				const instanceModule = server.moduleGraph.getModuleById(
					RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
				)
				if (instanceModule) {
					server.moduleGraph.invalidateModule(instanceModule)
					return [...modules, instanceModule]
				}
			}

			if (file.endsWith('.html')) {
				const relativePath = path.relative(state.config.root, file).replace(/\\/g, '/')
				const clientScriptUrl =
					'\0' + CLIENT_SCRIPT_PREFIX + relativePath.replace(/\.html$/i, '.js')
				const virtualModule = server.moduleGraph.getModuleById(clientScriptUrl)

				if (virtualModule) {
					server.moduleGraph.invalidateModule(virtualModule)
				}
			}

			return modules
		},
	}
}

/**
 * Aero Vite plugin factory. Returns an array of plugins: config, virtuals, transform, SSR, HMR,
 * static-build, image optimizer, and optionally Nitro (serve only).
 *
 * @param options - AeroOptions (nitro, apiPrefix, dirs). Nitro can be disabled at runtime via AERO_NITRO=false.
 * @returns PluginOption[] to pass to Vite's plugins array.
 */
export function aero(options: AeroOptions = {}): PluginOption[] {
	const dirs = resolveDirs(options.dirs)
	const apiPrefix = options.apiPrefix || DEFAULT_API_PREFIX
	const enableNitro = options.nitro === true && process.env.AERO_NITRO !== 'false'

	const runtimeInstanceJsPath = fileURLToPath(
		new URL('../runtime/instance.js', import.meta.url),
	)
	const runtimeInstanceTsPath = fileURLToPath(
		new URL('../runtime/instance.ts', import.meta.url),
	)
	const runtimeInstancePath = existsSync(runtimeInstanceJsPath)
		? runtimeInstanceJsPath
		: runtimeInstanceTsPath

	const state: AeroPluginState = {
		config: null,
		aliasResult: null,
		clientScripts: new Map<string, ScriptEntry>(),
		runtimeInstancePath,
		dirs,
		apiPrefix,
		options,
	}

	const aeroConfigPlugin = createAeroConfigPlugin(state)
	const aeroVirtualsPlugin = createAeroVirtualsPlugin(state)
	const aeroTransformPlugin = createAeroTransformPlugin(state)
	const aeroSsrPlugin = createAeroSsrPlugin(state)
	const aeroHmrPlugin = createAeroHmrPlugin(state)

	/** Plugins needed for static build (resolve, load, transform); no SSR/HMR. */
	const aeroCorePlugins: Plugin[] = [
		aeroConfigPlugin,
		aeroVirtualsPlugin,
		aeroTransformPlugin,
	]

	const staticBuildPlugin: Plugin = {
		name: 'vite-plugin-aero-static',
		apply: 'build',
		async closeBundle() {
			const root = state.config!.root
			const outDir = state.config!.build.outDir
			const shouldMinifyHtml =
				state.config!.build.minify !== false && process.env.NODE_ENV === 'production'
			await renderStaticPages(
				{
					root,
					resolvePath: state.aliasResult!.resolvePath,
					dirs: options.dirs,
					apiPrefix,
					configFile: state.config!.configFile,
					vitePlugins: state.config!.configFile ? [] : aeroCorePlugins,
					minify: shouldMinifyHtml,
					site: options.site,
					redirects: options.redirects,
				},
				outDir,
			)
			if (enableNitro) {
				process.env.AERO_REDIRECTS = JSON.stringify(options.redirects ?? [])
				await runNitroBuild(root)
			}
		},
	}

	const plugins: PluginOption[] = [
		aeroConfigPlugin,
		aeroVirtualsPlugin,
		aeroTransformPlugin,
		aeroSsrPlugin,
		aeroHmrPlugin,
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

	if (enableNitro) {
		const rawNitroPlugins = nitro({ serverDir: dirs.server })
		const nitroPlugins = Array.isArray(rawNitroPlugins) ? rawNitroPlugins : [rawNitroPlugins]
		for (const nitroPlugin of nitroPlugins) {
			if (!nitroPlugin || typeof nitroPlugin !== 'object') continue
			const originalApply = nitroPlugin.apply
			plugins.push({
				...nitroPlugin,
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
