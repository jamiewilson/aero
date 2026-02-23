/**
 * Resolve a request URL path to an Aero page name for runtime/Vite lookup.
 *
 * Used by the Vite dev server middleware and static build to map incoming paths
 * (e.g. `/about`, `/blog/post`) to the page module key (e.g. `about`, `blog/post`).
 * Strips query and hash; trailing slash becomes `/index` → `blog/index`.
 *
 * @packageDocumentation
 */

/**
 * Resolves a URL path to an Aero page name.
 *
 * @param url - Full URL or path (e.g. `/about`, `/about?foo=bar`, `/blog/`).
 * @returns Page name for lookup in pagesMap (e.g. `index`, `about`, `blog/index`, `blog/post`).
 *
 * @example
 * resolvePageName('/') // 'index'
 * resolvePageName('/about') // 'about'
 * resolvePageName('/about.html') // 'about'
 * resolvePageName('/blog/') // 'blog/index'
 * resolvePageName('/blog/post') // 'blog/post'
 * resolvePageName('/about?foo=bar') // 'about'
 */
export function resolvePageName(url: string): string {
	const [pathPart] = url.split('?')
	let clean = pathPart || '/'

	if (clean === '/' || clean === '') return 'index'

	// If it ends with a slash, treat as /foo/ -> foo/index
	if (clean.endsWith('/')) {
		clean = clean + 'index'
	}

	clean = clean.replace(/^\//, '')
	clean = clean.replace(/\.html$/, '')

	return clean || 'index'
}
