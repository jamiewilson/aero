import { tbd, loadAliases } from './src/vite'
import { nitro } from 'nitro/vite'
import { defineConfig, type PluginOption } from 'vite'

const { aliases, resolvePath } = loadAliases()
const plugins: PluginOption[] = [tbd({ resolvePath })]

if (process.env.WITH_NITRO === 'true') {
	plugins.push(nitro({ serverDir: './server' }))
}

export default defineConfig({
	plugins,
	resolve: { alias: aliases },
	server: process.env.TBD_API_PROXY
		? { proxy: { '/api': process.env.TBD_API_PROXY } }
		: undefined,
})
