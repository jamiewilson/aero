/**
 * Aero Vite HTML transform plugin (dev path for real .html module ids).
 */

import type { Plugin } from 'vite'
import {
	AERO_HTML_VIRTUAL_PREFIX,
	AERO_SNIPPET_VIRTUAL_PREFIX,
} from './defaults'
import { htmlCompileTry } from './compile-html-try'
import {
	compileHtmlWithDedupedWarnings,
	compileOrReport,
} from './compile-warning-dedup'
import type { AeroPluginState } from './plugin-state'
import { isSnippetModulePath } from '../snippets'

export function createAeroTransformPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-transform',
		enforce: 'pre',
		transform(code, id) {
			if (id.startsWith(AERO_HTML_VIRTUAL_PREFIX)) return null
			if (id.startsWith(AERO_SNIPPET_VIRTUAL_PREFIX)) return null
			if (isSnippetModulePath(id)) return null
			if (!id.endsWith('.html')) return null
			if (!state.config || !state.aliasResult) return null
			const resolvedConfig = state.config
			const resolvedAlias = state.aliasResult

			const generated = compileOrReport(
				this,
				() =>
					htmlCompileTry(id, () =>
						compileHtmlWithDedupedWarnings(
							code,
							id,
							{
								resolvedConfig,
								resolvePath: resolvedAlias.resolve,
								reactivity: state.options.reactivity,
								hypermedia: state.options.hypermedia,
								dirs: state.dirs,
							},
							state.clientScripts,
							state.compileWarningHashes
						)
					),
				id,
				'vite-plugin-aero-transform'
			)
			return generated
		},
	}
}
