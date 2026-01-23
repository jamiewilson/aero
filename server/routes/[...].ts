import { tbd } from '~/src/runtime/context'
import { defineHandler } from 'nitro/h3'

export default defineHandler(async event => {
	const url = event.url.pathname
	event.res.headers.set('Content-Type', 'text/html; charset=utf-8')
	let pageName = url === '/' ? 'index' : url.slice(1)
	return await tbd.render(pageName)
})
