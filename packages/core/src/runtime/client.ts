/**
 * Client-side re-render: fetch HTML for the current URL and patch the document.
 *
 * @remarks
 * Used by the client entry's HMR callback. Resolves the page name from `window.location.pathname`,
 * calls the provided render function to get HTML, then updates `<head>` (while preserving Vite dev
 * client nodes) and the app root's inner HTML. Runs only in the browser.
 */

import type { PageFragments } from '../types'
import { resolvePageName } from '../utils/routing'

/**
 * Parse a full HTML string into head and body fragments.
 * If the document has no head/body, body falls back to the raw HTML.
 *
 * @param html - Full document HTML (e.g. from the compiled render function).
 * @returns Head inner HTML and body inner HTML.
 */
function extractDocumentParts(html: string): PageFragments {
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')

	const head = doc.head?.innerHTML?.trim() || ''
	const body = doc.body?.innerHTML ?? html

	return { head, body }
}

/** CSS selectors for nodes that must be kept in <head> during HMR (Vite dev client and dev-injected modules). */
// prettier-ignore
const PERSISTENT_SELECTORS = [
	'script[src*="/@vite/client"]',
	'[data-vite-dev-id]'
].join(', ')

/**
 * Replace document head content with new HTML while preserving nodes matching PERSISTENT_SELECTORS.
 * Avoids re-adding duplicate Vite dev nodes by skipping if a node with the same data-vite-dev-id or script src already exists.
 */
function updateHead(headContent: string) {
	const headEl = document.head
	const queriedNodes = headEl.querySelectorAll(PERSISTENT_SELECTORS)
	const persistentSet = new Set(Array.from(queriedNodes))

	for (const node of Array.from(headEl.children)) {
		if (persistentSet.has(node)) continue
		headEl.removeChild(node)
	}
	const parser = new DOMParser()
	const frag = parser.parseFromString(`<head>${headContent}</head>`, 'text/html')
	const nodes = Array.from(frag.head?.childNodes || [])

	for (const node of nodes) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element
			if (el.matches(PERSISTENT_SELECTORS)) {
				const devId = el.getAttribute('data-vite-dev-id')
				if (devId && headEl.querySelector(`[data-vite-dev-id="${devId}"]`)) continue
				if (
					el instanceof HTMLScriptElement &&
					el.src &&
					headEl.querySelector(`script[src="${el.src}"]`)
				) {
					continue
				}
			}
		}

		headEl.appendChild(document.importNode(node, true))
	}
}

/**
 * Re-render the current page in the browser (e.g. on HMR).
 * Resolves page name from `window.location.pathname`, fetches HTML via `renderFn`, updates head and app root.
 *
 * @param appEl - Root element to receive the new body content (e.g. `#app`).
 * @param renderFn - Async function that returns full document HTML for a given page name (e.g. `aero.render`).
 */
export async function renderPage(
	appEl: HTMLElement,
	renderFn: (pageName: string) => Promise<string>,
) {
	const pageName = resolvePageName(window.location.pathname)

	try {
		const html = await renderFn(pageName)
		const { head, body } = extractDocumentParts(html)
		if (head) updateHead(head)
		appEl.innerHTML = body
		console.log(`[aero] Rendered: ${pageName}`)
	} catch (err) {
		appEl.innerHTML = `<h1>Error rendering page: ${pageName}</h1><pre>${String(err)}</pre>`
		console.error('[aero] Render Error:', err)
	}
}
