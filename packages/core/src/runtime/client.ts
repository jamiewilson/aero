/**
 * Client-side re-render: fetch HTML for the current URL and patch the document.
 *
 * @remarks
 * Used by the client entry's HMR callback. Resolves the page name from `window.location.pathname`,
 * calls the provided render function to get HTML, then updates `<head>` (while preserving Vite dev
 * client nodes) and the app root's inner HTML. Runs only in the browser.
 */

import type { PageFragments } from '../types'
import type { AeroDiagnostic } from '@aero-js/diagnostics/browser'
import {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	decodeDiagnosticsHeaderValue,
	escapeForBrowserPre,
	extractDiagnosticsFromDevErrorHtml,
	formatDiagnosticsBrowserHtml,
} from '@aero-js/diagnostics/browser'
import { resolvePageName } from '../utils/routing'
import { aeroDevLog } from './dev-log'

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

/** Guard: skip starting a new render while one is in progress (avoids overlapping HMR runs). */
let rendering = false

function diagnosticsFromDevFetch(res: Response, html: string): AeroDiagnostic[] | null {
	const raw = res.headers.get(AERO_DIAGNOSTICS_HTTP_HEADER)
	if (raw) {
		const fromHeader = decodeDiagnosticsHeaderValue(raw)
		if (fromHeader !== null && fromHeader.length > 0) return fromHeader
	}
	return extractDiagnosticsFromDevErrorHtml(html)
}

function showRenderDiagnostics(
	appEl: HTMLElement,
	pageName: string,
	diagnostics: AeroDiagnostic[]
): void {
	const title = escapeForBrowserPre(pageName)
	const panel = formatDiagnosticsBrowserHtml(diagnostics)
	appEl.innerHTML = `<h1>Error rendering page: ${title}</h1>${panel}`
	console.groupCollapsed('[aero] Diagnostics')
	for (const d of diagnostics) {
		const loc = d.file && d.span ? `${d.file}:${d.span.line}:${d.span.column}` : d.file || ''
		aeroDevLog('error', d.code, `${loc ? `${loc} ` : ''}${d.message}`)
	}
	console.groupEnd()
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
 * In dev (when import.meta.hot exists), fetches HTML from the dev server for all routes to avoid
 * running the full markdown pipeline in the browser, which can cause crashes when DevTools is open.
 * Otherwise resolves page name and uses `renderFn`.
 *
 * @param appEl - Root element to receive the new body content (e.g. `#app`).
 * @param renderFn - Async function that returns full document HTML for a given page name (e.g. `aero.render`).
 */
export async function renderPage(
	appEl: HTMLElement,
	renderFn: (pageName: string) => Promise<string>
) {
	if (rendering) return
	rendering = true
	const pathname = window.location.pathname
	const pageName = resolvePageName(pathname)

	try {
		let html: string
		const useFetch = typeof window !== 'undefined' && import.meta.hot
		if (useFetch) {
			const res = await fetch(pathname, { headers: { Accept: 'text/html' } })
			html = await res.text()
			if (!res.ok) {
				const diagnostics = diagnosticsFromDevFetch(res, html)
				if (diagnostics !== null && diagnostics.length > 0) {
					showRenderDiagnostics(appEl, pageName, diagnostics)
					return
				}
				throw new Error(`Fetch failed: ${res.status}`)
			}
		} else {
			html = await renderFn(pageName)
		}
		const { head, body } = extractDocumentParts(html)
		if (head) updateHead(head)
		appEl.innerHTML = body
	} catch (err) {
		const safe = escapeForBrowserPre(err instanceof Error ? err.message : String(err))
		appEl.innerHTML = `<h1>Error rendering page: ${escapeForBrowserPre(pageName)}</h1><pre>${safe}</pre>`
		aeroDevLog('error', 'AERO_INTERNAL', err instanceof Error ? err.message : String(err))
	} finally {
		rendering = false
	}
}
