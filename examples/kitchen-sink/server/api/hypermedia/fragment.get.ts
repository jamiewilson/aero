import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 300))
	return `<div class="card p-4 text-sm bg-green-500/10">Fragment loaded from <code>/api/hypermedia/fragment</code></div>`
})
