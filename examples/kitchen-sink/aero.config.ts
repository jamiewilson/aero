import { defineConfig } from '@aero-js/config'

export default defineConfig({
	content: true,
	server: true,
	reactivity: true,
	hypermedia: true,
	site: { url: 'https://with.aero' },
	redirects: [{ from: '/home', to: '/' }],
})
