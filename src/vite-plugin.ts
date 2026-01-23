import type { Plugin, ResolvedConfig } from 'vite'
import { parse } from './compiler/parser'
import { compile } from './compiler/codegen'
import path from 'path'

export interface TBDOptions {
	resolvePath?: (specifier: string) => string
}

function resolvePageNameFromUrl(url: string): string {
	const [pathPart] = url.split('?')
	let clean = pathPart || '/'
	if (clean === '/' || clean === '') return 'index'
	// If it ends with a slash, treat as /foo/ -> foo/index
	if (clean.endsWith('/')) clean = clean + 'index'
	clean = clean.replace(/^\//, '')
	clean = clean.replace(/\.html$/, '')
	return clean || 'index'
}

export function tbd(options: TBDOptions = {}): Plugin {
	const clientScripts = new Map<string, string>()
	let config: ResolvedConfig
	let appDir: string

	return {
		name: 'vite-plugin-tbd',

		configResolved(resolvedConfig) {
			config = resolvedConfig
			appDir = path.resolve(config.root, 'app')
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
					const pageName = resolvePageNameFromUrl(req.url)
					const mod = await server.ssrLoadModule('/src/runtime/context.ts')
					const rendered = await mod.tbd.render(pageName)
					const transformed = await server.transformIndexHtml(req.url, rendered)
					res.setHeader('Content-Type', 'text/html; charset=utf-8')
					res.end(transformed)
				} catch (err) {
					next(err as any)
				}
			})
		},

		async resolveId(id, importer) {
			if (id.endsWith('?on-client')) {
				return id
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
			if (id.endsWith('?on-client')) {
				const content = clientScripts.get(id)
				return content || ''
			}
			return null
		},

		transform(code, id) {
			// Only process .html files (resolved absolute paths)
			if (!id.endsWith('.html')) return null

			try {
				const parsed = parse(code)

				let clientScriptUrl = undefined
				if (parsed.clientScript) {
					clientScriptUrl = `${id}?on-client`
					clientScripts.set(clientScriptUrl, parsed.clientScript.content)
				}

				const generated = compile(parsed, {
					appDir,
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
	}
}
