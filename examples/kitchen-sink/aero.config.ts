import { defineConfig } from 'aerobuilt/config'

export default defineConfig({
	dirs: {
		client: './frontend',
		server: './backend',
		dist: './build',
	},
	site: 'https://with.aero',
	redirects: [{ from: '/home', to: '/' }],
	content: true,
	server: true,
})
