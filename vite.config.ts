import { Features } from 'lightningcss'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { tbdPlugin } from './src/vite-plugin'
import path from 'path'

export default defineConfig({
	plugins: [tbdPlugin(), process.env.VITEST ? undefined : nitro()],

	resolve: {
		alias: {
			'#layouts': path.resolve(__dirname, './app/layouts'),
		},
	},
	nitro: {
		serverDir: './server',
	},
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			exclude: Features.LightDark,
		},
	},
})
