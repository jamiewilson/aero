import { aero } from 'aerobuilt/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero(),
	build: {
		rolldownOptions: {
			external: ['htmx.org', 'alpinejs'],
		},
	},
})
