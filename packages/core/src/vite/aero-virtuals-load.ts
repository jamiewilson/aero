/**
 * Virtual-modules plugin: load() for runtime instance, templates, snippets, client scripts.
 */

import type { Plugin } from 'vite'
import { extractObjectKeys } from '../utils/parse'
import { readFileSync } from 'node:fs'
import {
	AERO_EMPTY_INLINE_CSS_PREFIX,
	AERO_HTML_VIRTUAL_PREFIX,
	AERO_SNIPPET_VIRTUAL_PREFIX,
	fromAeroStyleVirtualModuleId,
	fromSnippetVirtualModuleId,
	CLIENT_SCRIPT_PREFIX,
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	RESOLVED_STATE_BINDINGS_REGISTRY_MODULE_ID,
} from './defaults'
import { htmlCompileTry } from './compile-html-try'
import { getRuntimeInstanceModuleSource } from './runtime-instance-module'
import {
	compileHtmlWithDedupedWarnings,
	compileOrReport,
} from './compile-warning-dedup'
import type { AeroPluginState } from './plugin-state'
import { compileSnippetModule } from '../snippets'
import { extractTopLevelStyleBodies } from './template-style-bodies'

type LoadFn = NonNullable<Plugin['load']>

export function createAeroVirtualsLoad(state: AeroPluginState): LoadFn {
	return function load(this: any, id) {
		if (id === RESOLVED_STATE_BINDINGS_REGISTRY_MODULE_ID) {
			return `export async function resolveStateBindingsModule(_pathname) {
	return null
}
`
		}

		if (id === RESOLVED_RUNTIME_INSTANCE_MODULE_ID) {
			if (!state.config) return null
			return getRuntimeInstanceModuleSource(
				state.config.root,
				state.dirs.client,
				'@aero-js/core/runtime'
			)
		}

		if (id.startsWith(AERO_EMPTY_INLINE_CSS_PREFIX)) {
			return '/* aero: no inline styles */'
		}

		const styleRef = fromAeroStyleVirtualModuleId(id)
		if (styleRef) {
			this.addWatchFile(styleRef.filePath)
			const source = readFileSync(styleRef.filePath, 'utf-8')
			const bodies = extractTopLevelStyleBodies(source)
			return bodies[styleRef.index] ?? '/* aero: missing style block */'
		}

		if (id.startsWith(AERO_SNIPPET_VIRTUAL_PREFIX)) {
			const filePath = fromSnippetVirtualModuleId(id)
			if (!filePath) return null
			// So Vite invalidates this virtual module when the snippet source changes (HMR).
			this.addWatchFile(filePath)
			const source = readFileSync(filePath, 'utf-8')
			return compileOrReport(
				this,
				() => ({ code: compileSnippetModule(source, filePath), map: null }),
				filePath,
				'vite-plugin-aero-virtuals'
			)
		}

		if (id.startsWith(AERO_HTML_VIRTUAL_PREFIX)) {
			const filePath = id.slice(AERO_HTML_VIRTUAL_PREFIX.length).replace(/\.aero$/i, '.html')
			if (!state.config || !state.aliasResult) return null
			const resolvedConfig = state.config
			const resolvedAlias = state.aliasResult
			// So Vite invalidates this virtual module when the source .html changes (HMR).
			this.addWatchFile(filePath)
			const generated = compileOrReport(
				this,
				() =>
					htmlCompileTry(filePath, () => {
						const code = readFileSync(filePath, 'utf-8')
						return compileHtmlWithDedupedWarnings(
							code,
							filePath,
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
					}),
				filePath,
				'vite-plugin-aero-virtuals'
			)
			return generated
		}

		if (id.startsWith('\0' + CLIENT_SCRIPT_PREFIX)) {
			const virtualId = id.slice(1)
			const entry = state.clientScripts.get(virtualId)
			if (!entry) return ''

			if (entry.passDataExpr) {
				const keys = extractObjectKeys(entry.passDataExpr)
				if (keys.length > 0) {
					const preamble = `import { reviveStateValue } from '@aero-js/reactivity';\nvar __aero_raw=(typeof window!=='undefined'&&window.__aero_data_next!==undefined)?window.__aero_data_next:{};if(typeof window!=='undefined')delete window.__aero_data_next;var __aero_data={};for(const [__aero_k,__aero_v] of Object.entries(__aero_raw))__aero_data[__aero_k]=reviveStateValue(__aero_v);const { ${keys.join(', ')} } = __aero_data;\n`
					return preamble + entry.content
				}
			}

			return entry.content
		}
		return null
	}
}
