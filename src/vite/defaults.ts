import type { TbdDirs } from '../types'

/** Virtual URL prefix for on:client scripts. Root-relative, .js extension, no filesystem path. */
export const CLIENT_SCRIPT_PREFIX = '/@tbd/client/'

/** Default directory conventions */
export const DEFAULT_DIRS: Required<TbdDirs> = {
	templates: 'client',
	pages: 'client/pages',
	data: 'data',
	server: './server',
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
export function resolveDirs(dirs?: Partial<TbdDirs>): Required<TbdDirs> {
	return { ...DEFAULT_DIRS, ...dirs }
}
