import { aero } from '@aero-js/vite'
import { aeroContent } from '@aero-js/content/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		aero({
			site: 'https://aerojs.dev',
			staticServerPlugins: [aeroContent()],
		}),
		aeroContent(),
	],
})
