import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	return `<p class="secondary">Hypermedia fragment loaded from <code>/api/hypermedia-demo</code>.</p>`
})
