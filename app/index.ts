import '@/assets/styles/global.css'

import { tbd, onUpdate } from '~/src/runtime/context'
import htmx from '@/assets/scripts/htmx'
import Alpine from '@/assets/scripts/alpine'

const appEl = document.getElementById('app') as HTMLElement | null

const PERSISTENT_HEAD_SELECTOR = ['script[src*="/@vite/client"]', '[data-vite-dev-id]'].join(
	', ',
)

// Helper: get current page name from location
function getPageName() {
	let path = window.location.pathname
	if (path === '/' || path === '') return 'index'
	// Simplified page name resolution: /about -> about, /blog/post -> blog/post
	return path.replace(/^\//, '').replace(/\.html$/, '') || 'index'
}

async function renderPage() {
	if (!appEl) {
		console.warn('[tbd] No #app element found to render into')
		return
	}

	const pageName = getPageName()
	console.log('Resolved page name:', pageName)

	try {
		// Use the singleton tbd instance to render
		const html = await tbd.render(pageName)
		const { head, body } = extractDocumentParts(html)

		if (head) updateHead(head)
		appEl.innerHTML = body

		// Re-initialize Alpine/HTMX on the new content
		htmx.process(appEl)
		console.log(`[tbd] Rendered: ${pageName}`)
	} catch (err) {
		appEl.innerHTML = `<h1>Error rendering page: ${pageName}</h1><pre>${String(err)}</pre>`
		console.error('[tbd] Render Error:', err)
	}
}

// Initial render
renderPage()

// Subscribe to context updates (template changes, site data, etc.)
onUpdate(() => {
	renderPage()
})

// Initialize Alpine.js for HTMX-loaded content
htmx.onLoad(node => {
	Alpine.initTree(node as HTMLElement)
})

function extractDocumentParts(html: string): { head: string; body: string } {
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')

	const head = doc.head?.innerHTML?.trim() || ''
	const body = doc.body?.innerHTML ?? html

	return { head, body }
}

function updateHead(nextHeadHtml: string) {
	const headEl = document.head

	const persistent = Array.from(headEl.querySelectorAll(PERSISTENT_HEAD_SELECTOR)).map(
		node => node.cloneNode(true) as HTMLElement,
	)

	headEl.innerHTML = nextHeadHtml

	for (const node of persistent) {
		if (node instanceof HTMLScriptElement && node.src) {
			if (!headEl.querySelector(`script[src="${node.src}"]`)) headEl.appendChild(node)
			continue
		}

		const devId = node.getAttribute('data-vite-dev-id')
		if (devId && !headEl.querySelector(`[data-vite-dev-id="${devId}"]`)) {
			headEl.appendChild(node)
		}
	}
}
