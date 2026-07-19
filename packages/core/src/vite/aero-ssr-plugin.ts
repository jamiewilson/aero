/**
 * Aero Vite SSR middleware plugin.
 */

import type { Plugin, ViteDevServer } from 'vite'
import type { AeroPluginState } from './plugin-state'
import { handleSsrRequest } from './ssr-middleware'

export function createAeroSsrPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-ssr',
		configureServer(server: ViteDevServer) {
			server.middlewares.use(async (req, res, next) => {
				await handleSsrRequest(req, res, next, state, server)
			})
		},
	}
}
