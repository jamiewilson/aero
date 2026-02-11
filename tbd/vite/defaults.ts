import type { TbdDirs } from '../types'

/** Virtual URL prefix for on:client scripts. Root-relative, .js extension, no filesystem path. */
export const CLIENT_SCRIPT_PREFIX = '/@tbd/client/'

/** Default directory conventions */
export const DEFAULT_DIRS = {
	src: 'client',
	data: 'data',
	server: 'server',
	dist: 'dist',
}

/** Default API route prefix */
export const DEFAULT_API_PREFIX = '/api'

/** HTML attributes scanned for URL rewriting during static build */
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

/** URLs matching this pattern are left untouched during static build rewriting */
export const SKIP_PROTOCOL_REGEX =
	/^(?:https?:\/\/|\/\/|mailto:|tel:|data:|javascript:|#|blob:|file:\/\/)/i

/** Resolve user-provided dirs with defaults */
export interface ResolvedTbdDirs {
	src: string
	pages: string
	data: string
	server: string
	dist: string
}

export function resolveDirs(dirs?: Partial<TbdDirs>): ResolvedTbdDirs {
	const src = dirs?.src ?? DEFAULT_DIRS.src
	return {
		src,
		pages: `${src}/pages`,
		data: dirs?.data ?? DEFAULT_DIRS.data,
		server: dirs?.server ?? DEFAULT_DIRS.server,
		dist: dirs?.dist ?? DEFAULT_DIRS.dist,
	}
}
