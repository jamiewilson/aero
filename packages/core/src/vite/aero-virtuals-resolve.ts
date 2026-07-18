/**
 * Virtual-modules plugin: resolveId for runtime instance, client scripts, templates, snippets.
 */

import type { Plugin } from 'vite'
import {
	AERO_EMPTY_INLINE_CSS_PREFIX,
	AERO_HTML_VIRTUAL_PREFIX,
	AERO_SNIPPET_VIRTUAL_PREFIX,
	toSnippetVirtualModuleId,
	CLIENT_SCRIPT_PREFIX,
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	RESOLVED_STATE_BINDINGS_REGISTRY_MODULE_ID,
	RUNTIME_INSTANCE_MODULE_ID,
	STATE_BINDINGS_REGISTRY_MODULE_ID,
} from './defaults'
import { isAeroTemplateHtml } from './is-aero-template-html'
import type { AeroPluginState } from './plugin-state'
import { isSnippetModulePath } from '../snippets'

type ResolveIdFn = NonNullable<Plugin['resolveId']>

export function createAeroVirtualsResolveId(state: AeroPluginState): ResolveIdFn {
	return async function resolveId(this: any, id, importer) {
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
	}
}
