import { defineConfig, type PluginOption } from 'vite'
import { Features } from 'lightningcss'
import { nitro } from 'nitro/vite'
import { tbd } from './src/vite-plugin'
import { loadTsconfigAliases } from './src/utils/tsconfig-aliases'

const { aliases, resolvePath } = loadTsconfigAliases(process.cwd())
const plugins: PluginOption[] = [tbd({ resolvePath })]

if (process.env.WITH_NITRO === 'true') {
	plugins.push(nitro({ serverDir: './server' }))
}

export default defineConfig({
	plugins,
	resolve: { alias: aliases },
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			exclude: Features.LightDark,
		},
	},
	// Enable a dev proxy to an API server (e.g., Nitro) when TBD_API_PROXY is set.
	server: process.env.TBD_API_PROXY
		? {
				proxy: {
					'/api': process.env.TBD_API_PROXY,
				},
			}
		: undefined,
})
