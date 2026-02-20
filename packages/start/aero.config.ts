import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
	content: true,
	server: true,
	vite: {
		build: {
			minify: false,
			cssMinify: false,
		},
	},
})
