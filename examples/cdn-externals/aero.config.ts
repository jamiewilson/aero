import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
	vite: {
		build: {
			rolldownOptions: {
				external: ['htmx.org', 'alpinejs'],
			},
		},
	},
})
