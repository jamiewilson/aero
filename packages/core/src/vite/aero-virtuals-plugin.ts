/**
 * Aero Vite virtual modules plugin: resolve/load, HMR, client scripts, snippets.
 */

import type { Plugin, ViteDevServer } from 'vite'
import { extractObjectKeys } from '../utils/parse'
import { parse } from '@aero-js/compiler'
import { toPosixRelative } from '../utils/path'
import { readFileSync } from 'node:fs'
import path from 'path'
import {
	AERO_EMPTY_INLINE_CSS_PREFIX,
	AERO_HTML_VIRTUAL_PREFIX,
	AERO_SNIPPET_VIRTUAL_PREFIX,
	fromSnippetVirtualModuleId,
	toSnippetVirtualModuleId,
	CLIENT_SCRIPT_PREFIX,
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	RESOLVED_STATE_BINDINGS_REGISTRY_MODULE_ID,
	RUNTIME_INSTANCE_MODULE_ID,
	STATE_BINDINGS_REGISTRY_MODULE_ID,
} from './defaults'
import { htmlCompileTry } from './compile-html-try'
import { syncClientScriptsForTemplate } from './client-script-sync'
import {
	TemplateDiscovery,
	discoverClientScriptContentMap,
	getRuntimeInstanceModuleSource,
} from './build'
import { writeRouteManifestGenerated } from '../routing/route-manifest'
import { writeRouteTypesGenerated } from '../routing/route-typegen'
import { writeSnippetTypesGenerated } from '../snippet-typegen'
import {
	compileHtmlWithDedupedWarnings,
	compileOrReport,
} from './compile-warning-dedup'
import { isAeroTemplateHtml } from './is-aero-template-html'
import { collectSnippetHotUpdateModules } from './snippet-hmr'
import type { AeroPluginState } from './plugin-state'
import { compileSnippetModule, isSnippetModulePath } from '../snippets'

export function createAeroVirtualsPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-virtuals',
		enforce: 'pre',
		buildStart() {
			if (!state.config) return
			state.clientScripts.clear()
			const discovery =
				state.templateDiscovery ?? new TemplateDiscovery(state.config.root, state.dirs.client)
			const contentMap = discoverClientScriptContentMap(
				state.config.root,
				state.dirs.client,
				discovery
			)
			contentMap.forEach((entry, url) => {
				state.clientScripts.set(url, entry)
			})
		},
		async handleHotUpdate(ctx) {
			if (!state.config || state.config.command === 'build') return

			const snippetModules = collectSnippetHotUpdateModules(ctx.file, ctx.server)
			if (snippetModules.length > 0) return snippetModules

			if (!ctx.file.endsWith('.html')) return
			if (!isAeroTemplateHtml(ctx.file, state.config.root, state.dirs)) return

			const code = await ctx.read()
			const parsed = parse(code)

			const relativePath = toPosixRelative(ctx.file, state.config.root)
			const baseName = relativePath.replace(/\.html$/i, '')
			const { changed, affectedIds } = syncClientScriptsForTemplate(
				parsed,
				baseName,
				state.clientScripts
			)
			if (!changed || affectedIds.length === 0) return

			const invalidated = new Set<any>()
			for (const virtualId of affectedIds) {
				const moduleId = '\0' + virtualId
				const mod =
					ctx.server.moduleGraph.getModuleById(moduleId) ||
					ctx.server.moduleGraph.getModuleById(virtualId)
				if (!mod || invalidated.has(mod)) continue
				ctx.server.moduleGraph.invalidateModule(mod)
				invalidated.add(mod)
			}

			// Module scripts executed via injected <script type="module" src="..."> need a full reload
			// so browser module caching does not keep stale script behavior.
			ctx.server.ws.send({ type: 'full-reload' })
			return []
		},
		configureServer(server: ViteDevServer) {
			const invalidateRuntimeRegistration = (): void => {
				const mod = server.moduleGraph.getModuleById(RESOLVED_RUNTIME_INSTANCE_MODULE_ID)
				if (mod) server.moduleGraph.invalidateModule(mod)
			}
			const regenerateRouteArtifacts = (): void => {
				if (!state.config) return
				const { manifest } = writeRouteManifestGenerated(state.config.root, state.dirs.client)
				writeRouteTypesGenerated(state.config.root, manifest)
			}
			const regenerateSnippetTypes = (): void => {
				if (!state.config) return
				writeSnippetTypesGenerated(state.config.root)
			}
			const onClientTemplateFs = (file: string): void => {
				if (!file.endsWith('.html')) return
				if (!state.config) return
				const clientRoot = path.resolve(state.config.root, state.dirs.client)
				const abs = path.resolve(file)
				if (abs !== clientRoot && !abs.startsWith(clientRoot + path.sep)) return
				regenerateRouteArtifacts()
				invalidateRuntimeRegistration()
			}
			server.watcher.on('add', onClientTemplateFs)
			server.watcher.on('unlink', onClientTemplateFs)
			const onSnippetFs = (file: string): void => {
				if (!state.config) return
				const snippetsRoot = path.resolve(state.config.root, 'content', 'snippets')
				const abs = path.resolve(file)
				if (abs !== snippetsRoot && !abs.startsWith(snippetsRoot + path.sep)) return
				regenerateSnippetTypes()
			}
			server.watcher.on('add', onSnippetFs)
			server.watcher.on('change', onSnippetFs)
			server.watcher.on('unlink', onSnippetFs)
		},
		async resolveId(id, importer) {
			// In dev: redirect client's runtime instance import to the virtual module.
			// The built instance has empty globs (bundler strips import.meta.glob); the virtual
			// module has app-specific globs so template changes invalidate the client and trigger HMR.
			if (state.config?.command !== 'build') {
				const isRelativeInstanceImport = id === './runtime/instance' || id === '../runtime/instance'
				const isFromCore =
					importer &&
					(importer.includes('entry-dev') ||
						importer.includes('@aero-js/core') ||
						importer.includes('/core/'))
				if (isRelativeInstanceImport && isFromCore) {
					return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
				}
				// Fallback: id might resolve to runtime instance (e.g. full path from pre-bundle)
				if (importer && (id.includes('runtime') || id.includes('instance'))) {
					const resolved = await this.resolve(id, importer, { skipSelf: true })
					if (
						resolved?.id &&
						/runtime\/instance\.(m?js|ts)$/.test(resolved.id) &&
						resolved.id.includes('aero')
					) {
						return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
					}
				}
			}

			if (id === RUNTIME_INSTANCE_MODULE_ID) {
				// In dev: use virtual module so load() fires and Vite's SSR transform rewrites exports
				// (Vite 8's AsyncFunction evaluator cannot parse raw ESM export syntax).
				// In build: resolve to real file under .aero so Vite's import-glob has a file context for glob patterns.
				if (state.config?.command === 'build' && state.generatedRuntimeInstancePath) {
					return state.generatedRuntimeInstancePath
				}
				return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
			}

			if (id === STATE_BINDINGS_REGISTRY_MODULE_ID) {
				if (state.config?.command === 'build' && state.generatedStateBindingsRegistryPath) {
					return state.generatedStateBindingsRegistryPath
				}
				return RESOLVED_STATE_BINDINGS_REGISTRY_MODULE_ID
			}

			if (id.startsWith(CLIENT_SCRIPT_PREFIX)) {
				return '\0' + id
			}
			if (id.startsWith('\0' + CLIENT_SCRIPT_PREFIX)) {
				return id
			}

			if (id.startsWith(AERO_HTML_VIRTUAL_PREFIX)) {
				return id
			}

			// Vite 8 may request .html with ?html-proxy&inline-css to extract inline styles; Aero .html are compiled to JS, so serve empty CSS.
			if (id.includes('html-proxy') && id.includes('inline-css')) {
				return AERO_EMPTY_INLINE_CSS_PREFIX + id
			}

			if (id.startsWith('aero:content')) {
				return null
			}

			if (id.startsWith(AERO_SNIPPET_VIRTUAL_PREFIX)) {
				return id
			}

			const resolved = await this.resolve(id, importer, { skipSelf: true })
			if (resolved && isSnippetModulePath(resolved.id)) {
				return toSnippetVirtualModuleId(resolved.id)
			}

			if (resolved && resolved.id.endsWith('.html')) {
				// Only in build: resolve Aero template .html to virtual id so vite:build-html never sees them.
				// In dev we keep the real path so Vite's file watcher invalidates the module when the file changes (HMR + fresh SSR).
				if (
					state.config?.command === 'build' &&
					state.aliasResult &&
					isAeroTemplateHtml(resolved.id, state.config.root, state.dirs)
				) {
					return AERO_HTML_VIRTUAL_PREFIX + resolved.id.replace(/\.html$/i, '.aero')
				}
				return resolved
			}

			return null
		},
		load(id) {
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
		},
	}
}
