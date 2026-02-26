import { defineConfig } from 'aerobuilt/config'

export default defineConfig({
	vite: {
		build: {
			rolldownOptions: {
				external: ['htmx.org', 'alpinejs'],
			},
		},
	},
})
