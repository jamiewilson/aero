import { tbd } from './src/vite'
import { defineConfig } from 'vite'
import { Features } from 'lightningcss'

export default defineConfig({
	plugins: tbd(),
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			exclude: Features.LightDark,
		},
	},
})
