import type { PageFragments } from '../types'
import { resolvePageName } from '../utils/routing'

function extractDocumentParts(html: string): PageFragments {
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')

	const head = doc.head?.innerHTML?.trim() || ''
	const body = doc.body?.innerHTML ?? html

	return { head, body }
}

// prettier-ignore
const PERSISTENT_SELECTORS = [
	'script[src*="/@vite/client"]',
	'[data-vite-dev-id]'
].join(', ')

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
		console.log(`[tbd] Rendered: ${pageName}`)
	} catch (err) {
		appEl.innerHTML = `<h1>Error rendering page: ${pageName}</h1><pre>${String(err)}</pre>`
		console.error('[tbd] Render Error:', err)
	}
}
