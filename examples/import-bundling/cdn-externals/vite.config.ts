import { aero } from '@aero-js/core/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero(),
	build: {
		rolldownOptions: {
			external: ['htmx.org', 'alpinejs'],
		},
	},
})
