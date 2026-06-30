import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	return `Hypermedia fragment loaded from <code>/api/hypermedia-demo</code>.`
})
