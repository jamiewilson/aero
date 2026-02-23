import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
	site: 'https://with.aero',
	redirects: [{ from: '/home', to: '/', status: 301 }],
	content: true,
	server: true,
})
