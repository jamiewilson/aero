import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 600))
	return `Hypermedia fragment loaded from <code>/api/hypermedia-demo</code>.`
})
