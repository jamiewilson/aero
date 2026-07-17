/** Marker on Aero SSR overlay-bootstrap error pages (`@aero-js/diagnostics`). */
const OVERLAY_BOOTSTRAP_ATTR = 'data-aero-overlay-bootstrap'

const FULL_DOCUMENT_RE = /^\s*<(!DOCTYPE\b|html[\s>])/i

/**
 * True when HTML is a fragment safe to swap into a hypermedia target.
 *
 * Full documents (Nitro youch / SSR error pages) and Aero overlay-bootstrap
 * shells are not swappable — injecting them leaks styles and breaks the page.
 */
export function isSwappableFragmentHtml(html: string): boolean {
	if (FULL_DOCUMENT_RE.test(html)) return false
	if (html.includes(OVERLAY_BOOTSTRAP_ATTR)) return false
	return true
}
