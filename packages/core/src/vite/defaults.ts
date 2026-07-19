/**
 * Vite plugin constants and directory resolution.
 *
 * @remarks
 * Defines virtual module IDs (runtime instance, client scripts), default dirs, API prefix,
 * and attributes/URL patterns used by the static build rewrite logic.
 */

import type { AeroDirs } from '../types'

/** Virtual URL prefix for extracted client scripts (e.g. `/@aero/client/client/pages/home.js`). Root-relative; no filesystem path. */
export const CLIENT_SCRIPT_PREFIX = '/@aero/client/'

/**
 * Virtual URL for one client script.
 * Single script uses `.ts`, multiple use `.0.ts`, `.1.ts`, etc.
 * Use this in the Vite transform and static build so URL generation is consistent.
 */
export function getClientScriptVirtualUrl(baseName: string, index: number, total: number): string {
	const suffix = total === 1 ? '.ts' : `.${index}.ts`
	return CLIENT_SCRIPT_PREFIX + baseName + suffix
}
/** Virtual module ID requested by the app; resolved to `RESOLVED_*` so `load()` can re-export from the real runtime instance. */
export const RUNTIME_INSTANCE_MODULE_ID = 'virtual:aero/runtime-instance.ts'
/** Resolved ID (with `\0` prefix) so Vite treats it as an internal module. */
export const RESOLVED_RUNTIME_INSTANCE_MODULE_ID = '\0virtual:aero/runtime-instance.ts'

/** Virtual module for production reactive page loaders (written under `.aero/` during build). */
export const STATE_BINDINGS_REGISTRY_MODULE_ID = 'virtual:aero/state-bindings-registry.ts'
export const RESOLVED_STATE_BINDINGS_REGISTRY_MODULE_ID =
	'\0virtual:aero/state-bindings-registry.ts'
/** Filename for the generated production state-bindings registry module. */
export const STATE_BINDINGS_REGISTRY_FILENAME = 'state-bindings-registry.mjs'

/** Prefix for virtual empty-CSS modules used when Vite requests .html?html-proxy&inline-css (Aero .html are JS, not HTML with styles). */
export const AERO_EMPTY_INLINE_CSS_PREFIX = '\0aero:empty-inline-css:'

/**
 * Virtual CSS from a template top-level `<style>` block.
 * Query ends with `index=N.css` so Vite and `@tailwindcss/vite` treat the id as CSS.
 */
export const AERO_STYLE_VIRTUAL_PREFIX = '\0aero:style:'

/** Virtual module id for the Nth top-level `<style>` in an Aero template (CSS source). */
export function toAeroStyleVirtualModuleId(filePath: string, index: number): string {
	return `${AERO_STYLE_VIRTUAL_PREFIX}${filePath}?index=${index}.css`
}

/** Import specifier that yields processed CSS as a string (`?inline`). */
export function toAeroStyleInlineImportId(filePath: string, index: number): string {
	return `${AERO_STYLE_VIRTUAL_PREFIX}${filePath}?inline&index=${index}.css`
}

/** Parse `\0aero:style:<absPath>?…index=N.css` into file path + index, or null. */
export function fromAeroStyleVirtualModuleId(
	id: string
): { filePath: string; index: number } | null {
	if (!id.startsWith(AERO_STYLE_VIRTUAL_PREFIX)) return null
	const rest = id.slice(AERO_STYLE_VIRTUAL_PREFIX.length)
	const q = rest.indexOf('?')
	if (q < 0) return null
	const filePath = rest.slice(0, q)
	const query = rest.slice(q + 1)
	const match = /(?:^|&)index=(\d+)\.css(?:&|$)/.exec(query)
	if (!match) return null
	return { filePath, index: Number(match[1]) }
}

/** Prefix for virtual HTML template modules. Resolving .html to this id returns compiled JS so vite:build-html never sees raw/compiled HTML. */
export const AERO_HTML_VIRTUAL_PREFIX = '\0aero-html:'

/** Prefix for virtual snippet module sources under `content/snippets/`. */
export const AERO_SNIPPET_VIRTUAL_PREFIX = '\0aero-snippet:'

/** Suffix so Vite treats compiled snippet modules as JS, not by source extension (e.g. `.css`). */
export const SNIPPET_VIRTUAL_MODULE_SUFFIX = '.mjs'

/** Virtual module id for a snippet source file on disk. */
export function toSnippetVirtualModuleId(filePath: string): string {
	return AERO_SNIPPET_VIRTUAL_PREFIX + filePath + SNIPPET_VIRTUAL_MODULE_SUFFIX
}

/** Source file path from a snippet virtual module id, or null when not a snippet virtual id. */
export function fromSnippetVirtualModuleId(virtualId: string): string | null {
	if (!virtualId.startsWith(AERO_SNIPPET_VIRTUAL_PREFIX)) return null
	const rest = virtualId.slice(AERO_SNIPPET_VIRTUAL_PREFIX.length)
	if (!rest.endsWith(SNIPPET_VIRTUAL_MODULE_SUFFIX)) return null
	return rest.slice(0, -SNIPPET_VIRTUAL_MODULE_SUFFIX.length)
}

/** Default directory names: client source, server (Nitro), dist output. */
export const DEFAULT_DIRS = {
	client: 'client',
	server: 'server',
	dist: 'dist',
}

/** Default API route prefix (e.g. `/api`). */
export const DEFAULT_API_PREFIX = '/api'

/** HTML attributes scanned for absolute URLs during static build rewrite (href, src, hx-*, action). */
export const LINK_ATTRS = [
	'href',
	'src',
	'action',
	'hx-get',
	'hx-post',
	'hx-put',
	'hx-patch',
	'hx-delete',
]

/** URLs matching this regex are not rewritten (external, protocol, hash, etc.). */
export const SKIP_PROTOCOL_REGEX =
	/^(?:https?:\/\/|\/\/|mailto:|tel:|data:|javascript:|#|blob:|file:\/\/)/i

/** Resolved directory paths (client, server, dist) after applying defaults. */
export interface ResolvedAeroDirs {
	client: string
	server: string
	dist: string
}

function getServerDir(dirs?: Partial<AeroDirs>): string {
	return dirs?.server ?? DEFAULT_DIRS.server
}

/**
 * Resolve optional user dir overrides with defaults (DEFAULT_DIRS).
 *
 * @param dirs - Optional partial AeroDirs (e.g. `{ dist: 'build' }` or `{ server: 'server' }`).
 * @returns ResolvedAeroDirs with all keys set.
 */
export function resolveDirs(dirs?: Partial<AeroDirs>): ResolvedAeroDirs {
	return {
		client: dirs?.client ?? DEFAULT_DIRS.client,
		server: getServerDir(dirs),
		dist: dirs?.dist ?? DEFAULT_DIRS.dist,
	}
}
