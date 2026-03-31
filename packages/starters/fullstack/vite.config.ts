import { aero } from '@aero-js/vite'
import { defineConfig } from 'vite'

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
