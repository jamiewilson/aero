/**
 * Resolves a URL path to a TBD page name.
 * 
 * Examples:
 * - / -> index
 * - /about -> about
 * - /about.html -> about
 * - /blog/ -> blog/index
 * - /blog/post -> blog/post
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
