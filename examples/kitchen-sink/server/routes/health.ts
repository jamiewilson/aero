import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	return new Response('ok', {
		headers: { 'content-type': 'text/plain' },
	})
})
