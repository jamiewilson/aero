import { aero } from '@aero-js/core/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
	plugins: [
		aero({
			server: true,
			site: {
				url: 'http://localhost:5173',
			},
		}),
	],
})
