import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 300))
	return `Fragment loaded from <code>/api/hypermedia/fragment</code>.`
})
