import { defineConfig } from 'vite'
import { Features } from 'lightningcss'
import { nitro } from 'nitro/vite'
import { tbd } from './src/vite-plugin'

export default defineConfig({
	plugins: [tbd(), process.env.VITEST ? undefined : nitro()],
	nitro: { serverDir: './server' },
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			exclude: Features.LightDark,
		},
	},
})
