export default {
	async fetch(request: Request) {
		const url = new URL(request.url)
		if (url.pathname === '/health') {
			return new Response('ok', {
				headers: {
					'content-type': 'text/plain',
				},
			})
		}
	},
}
