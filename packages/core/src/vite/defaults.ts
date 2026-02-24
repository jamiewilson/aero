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
 * Virtual URL for one client script. Single script uses `.js`, multiple use `.0.js`, `.1.js`, etc.
 * Use this in the Vite transform and static build so URL generation is consistent.
 */
export function getClientScriptVirtualUrl(baseName: string, index: number, total: number): string {
	const suffix = total === 1 ? '.js' : `.${index}.js`
	return CLIENT_SCRIPT_PREFIX + baseName + suffix
}
/** Virtual module ID requested by the app; resolved to `RESOLVED_*` so `load()` can re-export from the real runtime instance. */
export const RUNTIME_INSTANCE_MODULE_ID = 'virtual:aero/runtime-instance'
/** Resolved ID (with `\0` prefix) so Vite treats it as an internal module. */
export const RESOLVED_RUNTIME_INSTANCE_MODULE_ID = '\0virtual:aero/runtime-instance'

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

/** User dirs may use serverDir (config) or server (core); normalize to server. */
function getServerDir(dirs?: Partial<AeroDirs> & { serverDir?: string }): string {
	return dirs?.server ?? dirs?.serverDir ?? DEFAULT_DIRS.server
}

/**
 * Resolve optional user dir overrides with defaults (DEFAULT_DIRS).
 * Accepts both server and serverDir for the Nitro server directory.
 *
 * @param dirs - Optional partial AeroDirs (e.g. `{ dist: 'build' }` or `{ serverDir: 'server' }`).
 * @returns ResolvedAeroDirs with all keys set.
 */
export function resolveDirs(dirs?: Partial<AeroDirs> & { serverDir?: string }): ResolvedAeroDirs {
	return {
		client: dirs?.client ?? DEFAULT_DIRS.client,
		server: getServerDir(dirs),
		dist: dirs?.dist ?? DEFAULT_DIRS.dist,
	}
}
