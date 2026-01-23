import type { Plugin, ResolvedConfig } from 'vite'
import { parse } from './compiler/parser'
import { compile } from './compiler/codegen'
import path from 'path'

export function tbd(): Plugin {
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
	}
}
