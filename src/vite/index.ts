import type { TbdOptions, AliasResult } from '../types'
import type { Plugin, PluginOption, ResolvedConfig, UserConfig } from 'vite'
import { parse } from '../compiler/parser'
import { compile } from '../compiler/codegen'
import { resolvePageName } from '../utils/routing'
import { loadTsconfigAliases } from '../utils/aliases'
import { createBuildConfig, renderStaticPages } from './build'
import { CLIENT_SCRIPT_PREFIX, DEFAULT_API_PREFIX, resolveDirs } from './defaults'
import { nitro as nitroPlugin } from 'nitro/vite'
import path from 'path'

export function tbd(options: TbdOptions = {}): PluginOption[] {
	const clientScripts = new Map<string, string>()
	let config: ResolvedConfig
	let aliasResult: AliasResult
	const dirs = resolveDirs(options.dirs)
	const apiPrefix = options.apiPrefix || DEFAULT_API_PREFIX

	const mainPlugin: Plugin = {
		name: 'vite-plugin-tbd',

		config(userConfig) {
			const root = userConfig.root || process.cwd()
			aliasResult = loadTsconfigAliases(root)

			const injected: UserConfig = {
				base: './',
				resolve: { alias: aliasResult.aliases },
				build: createBuildConfig(
					{ resolvePath: aliasResult.resolvePath, dirs: options.dirs },
					root,
				),
			}

			// API proxy support (option or env var)
			const apiProxy = options.apiProxy || process.env.TBD_API_PROXY
			if (apiProxy) {
				injected.server = { proxy: { [apiPrefix]: apiProxy } }
			}

			return injected
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
					const mod = await server.ssrLoadModule('/src/runtime/instance.ts')

					let rendered = await mod.tbd.render(pageName)
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
			if (id.startsWith(CLIENT_SCRIPT_PREFIX)) {
				return '\0' + id
			}

			// 1. Try resolving the ID as-is (handles standard aliases and relative paths)
			const resolved = await this.resolve(id, importer, { skipSelf: true })
			if (resolved && resolved.id.endsWith('.html')) {
				return resolved
			}

			// 2. If it's a template import without .html extension (e.g. @/layouts/base)
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

				const resolvePath = options.resolvePath || aliasResult?.resolvePath
				const generated = compile(parsed, {
					root: config.root,
					clientScriptUrl,
					resolvePath,
				})

				return {
					code: generated,
					map: null,
				}
			} catch (err: any) {
				const relativePath = path.relative(config.root, id)
				this.error(`[tbd] Error compiling ${relativePath}: ${err.message}`)
				return null
			}
		},

		handleHotUpdate({ file, server, modules }) {
			// Handle HMR for data files - invalidate instance.ts to trigger re-import
			const dataDir = path.join(config.root, dirs.data)
			if (file.startsWith(dataDir) && file.endsWith('.ts')) {
				const instanceModule = server.moduleGraph.getModuleById(
					path.join(config.root, 'src/runtime/instance.ts'),
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
		name: 'vite-plugin-tbd-static',
		apply: 'build',
		async closeBundle() {
			const root = config.root
			const outDir = config.build.outDir
			// Expose outDir so the Nitro catch-all route can find the built files
			process.env.TBD_OUT_DIR = outDir
			const resolvePath = options.resolvePath || aliasResult?.resolvePath
			await renderStaticPages({ root, resolvePath, dirs: options.dirs, apiPrefix }, outDir)
		},
	}

	const plugins: PluginOption[] = [mainPlugin, staticBuildPlugin]

	// Nitro integration (option or env var)
	const enableNitro = options.nitro ?? process.env.WITH_NITRO === 'true'
	if (enableNitro) {
		plugins.push(nitroPlugin({ serverDir: dirs.server }))
	}

	return plugins
}
