import { aero } from '@aero-js/core/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
	plugins: aero(),
	build: {
		rolldownOptions: {
			external: ['htmx.org', 'alpinejs'],
		},
	},
})
