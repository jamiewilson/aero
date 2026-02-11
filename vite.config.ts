import { tbd } from './tbd/vite'
import { defineConfig } from 'vite'
import { Features } from 'lightningcss'

export default defineConfig({
	plugins: tbd({ nitro: true }),
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			exclude: Features.LightDark,
		},
	},
})
