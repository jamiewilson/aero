import { definePlugin } from 'nitro'

export default definePlugin(nitroApp => {
	nitroApp.hooks.hook('response', response => {
		response.headers.set('x-aero-nitro', 'true')
	})
})
