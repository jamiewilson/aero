import { aero } from '@aero-js/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero(),
	build: {
		rolldownOptions: {
			external: ['htmx.org', 'alpinejs'],
		},
	},
})
