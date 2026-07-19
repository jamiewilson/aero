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

/**
 * Emit `resolvePageName` as a plain JS function for generated client modules.
 * Production aliases `@aero-js/core` → `entry-prod`, so the registry cannot import this module.
 */
export function emitResolvePageNameFnSource(fnName: string): string {
	return `function ${fnName}(url) {
	const pathPart = String(url ?? '/').split('?')[0] || '/'
	let clean = pathPart
	if (clean === '/' || clean === '') return 'index'
	if (clean.endsWith('/')) clean = clean + 'index'
	clean = clean.replace(/^\\//, '').replace(/\\.html$/, '')
	return clean || 'index'
}`
}
