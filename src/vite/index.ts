import type { TbdOptions, AliasResult } from '../types'
import type { Plugin, ResolvedConfig } from 'vite'
import { parse } from '../compiler/parser'
import { compile } from '../compiler/codegen'
import { resolvePageName } from '../utils/routing'
import { loadTsconfigAliases } from '../utils/aliases'
import path from 'path'

/** Virtual URL prefix for on:client scripts. Root-relative, .js extension, no filesystem path. */
const CLIENT_SCRIPT_PREFIX = '/@tbd/client/'

/**
 * Load TypeScript path aliases from tsconfig.json
 * @param root - Project root directory (defaults to process.cwd())
 * @returns Alias configuration for Vite and path resolver function
 */
export function loadAliases(root?: string): AliasResult {
	return loadTsconfigAliases(root || process.cwd())
}

export function tbd(options: TbdOptions = {}): Plugin {
	const clientScripts = new Map<string, string>()
	let config: ResolvedConfig

	return {
		name: 'vite-plugin-tbd',

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
					pathname.startsWith('/api') ||
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

				const generated = compile(parsed, {
					root: config.root,
					clientScriptUrl,
					resolvePath: options.resolvePath,
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
			const dataDir = path.join(config.root, 'data')
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
}
