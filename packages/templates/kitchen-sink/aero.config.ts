import { defineConfig } from 'aerobuilt/config'

export default defineConfig({
	site: 'https://with.aero',
	redirects: [{ from: '/home', to: '/', status: 301 }],
	content: true,
	server: true,
})
