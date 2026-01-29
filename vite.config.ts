import { tbd } from './src/vite'
import { nitro } from 'nitro/vite'
import { defineConfig, type PluginOption } from 'vite'

// TODO: Can we move this to into tbd and call tbd.loadAliases() or similar?
import { loadTsconfigAliases } from './src/utils/aliases'
const { aliases, resolvePath } = loadTsconfigAliases(process.cwd())
const plugins: PluginOption[] = [tbd({ resolvePath })]

if (process.env.WITH_NITRO === 'true') {
	plugins.push(nitro({ serverDir: './server' }))
}

export default defineConfig({
	plugins,
	// TODO: Consider Node.js Subpath Imports instead of Tsconfig paths?
	resolve: { alias: aliases },
	// Enable a dev proxy to an API server (e.g., Nitro) when TBD_API_PROXY is set.
	server: process.env.TBD_API_PROXY
		? {
				proxy: {
					'/api': process.env.TBD_API_PROXY,
				},
			}
		: undefined,
})
