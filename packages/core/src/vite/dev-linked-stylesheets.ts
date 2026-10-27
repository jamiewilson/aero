/**
 * Dev SSR HTML helpers for `<link rel="stylesheet">` entries.
 */

import { SKIP_PROTOCOL_REGEX } from './defaults'

const LINKED_STYLESHEET_HREF_RE =
	/(<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["'])([^"']+)(["'])/gi

/** Append Vite's `?direct` query so CSS HMR can find the matching `<link>` in the document. */
export function appendDirectQueryToDevStylesheetLinks(html: string): string {
	return html.replace(LINKED_STYLESHEET_HREF_RE, (full, pre, href, post) => {
		if (SKIP_PROTOCOL_REGEX.test(href)) return full
		const pathOnly = href.split(/[?#]/)[0] ?? href
		if (!pathOnly.endsWith('.css')) return full
		if (href.includes('?') || href.includes('#')) return full
		return `${pre}${href}?direct${post}`
	})
}
