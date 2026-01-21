import { tbd } from '~/src/runtime/context'
import { defineHandler } from 'nitro/h3'

export default defineHandler(async event => {
	const url = event.url.pathname

	// Set content type for HTML responses
	event.res.headers.set('Content-Type', 'text/html; charset=utf-8')

	let pageName = url === '/' ? 'index' : url.slice(1)

	// Check if it's a known page
	const html = await tbd.render(pageName)

	if (html === `Page not found: ${pageName}`) {
		if (url === '/api/partial') {
			event.res.headers.set('Content-Type', 'text/plain')
			return `<p>Loaded from the server by htmx</p>`
		}

		// Try rendering 404 page
		const fourOhFour = await tbd.render('404')
		if (fourOhFour !== 'Page not found: 404') {
			event.res.status = 404
			return fourOhFour
		}
		return `Not found: ${url}`
	}

	return html
})
