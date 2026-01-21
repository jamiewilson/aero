import type { Plugin, ResolvedConfig } from 'vite'
import { parse } from './compiler/parser'
import { compile } from './compiler/codegen'
import path from 'path'

export function tbdPlugin(): Plugin {
	const clientScripts = new Map<string, string>()
	let config: ResolvedConfig
	let appDir: string

	return {
		name: 'vite-plugin-tbd',

		configResolved(resolvedConfig) {
			config = resolvedConfig
			appDir = path.resolve(config.root, 'app')
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

				const generated = compile(parsed, { appDir, clientScriptUrl })

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
			// Handle .html and site.ts file changes
			const isHtml = file.endsWith('.html')
			const isSiteData = file.endsWith('data/site.ts')

			if (isHtml || isSiteData) {
				console.log(`[tbd] HMR handleHotUpdate: ${file}`)

				// Send the custom event as a backup/trigger for cache-busting
				const relativePath = '/' + path.relative(config.root, file)
				server.ws.send('tbd:template-update', { id: relativePath })

				// For templates, we MUST NOT return [] if we want standard dependency
				// tracking (like our context.ts glob) to work.
				// Returning the modules but NOT invalidating them here allows Vite
				// to follow the graph.
				return modules
			}

			return modules
		},
	}
}
