import { tbd, onUpdate } from '~/src/runtime/context'
import htmx from '@/assets/scripts/htmx'
import Alpine from '@/assets/scripts/alpine'

const appEl = document.getElementById('app') as HTMLElement | null

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

	try {
		// Use the singleton tbd instance to render
		const html = await tbd.render(pageName)
		appEl.innerHTML = html

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

// HMR: listen for custom template updates from the plugin
if (import.meta.hot) {
	import.meta.hot.on('tbd:template-update', async (data: { id: string }) => {
		try {
			// If it's a template, update the registry
			if (data.id.endsWith('.html')) {
				const mod = await import(/* @vite-ignore */ data.id + `?t=${Date.now()}`)
				tbd.registerPages({ [data.id]: mod })
			}

			// Force a re-render
			await renderPage()
		} catch (err) {
			console.error('[tbd] HMR Error:', err)
		}
	})
}

// Initialize Alpine.js for HTMX-loaded content
htmx.onLoad(node => {
	Alpine.initTree(node as HTMLElement)
})
