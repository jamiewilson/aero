/**
 * Aero Vite virtual modules plugin: resolve/load, HMR, client scripts, snippets.
 */

import type { Plugin } from 'vite'
import {
	TemplateDiscovery,
	discoverClientScriptContentMap,
} from './rollup-input-discovery'
import type { AeroPluginState } from './plugin-state'
import { createAeroVirtualsResolveId } from './aero-virtuals-resolve'
import { createAeroVirtualsLoad } from './aero-virtuals-load'
import {
	createAeroVirtualsConfigureServer,
	createAeroVirtualsHandleHotUpdate,
} from './aero-virtuals-hmr'

export function createAeroVirtualsPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-virtuals',
		enforce: 'pre',
		buildStart() {
			if (!state.config) return
			state.clientScripts.clear()
			const discovery =
				state.templateDiscovery ?? new TemplateDiscovery(state.config.root, state.dirs.client)
			const contentMap = discoverClientScriptContentMap(
				state.config.root,
				state.dirs.client,
				discovery
			)
			contentMap.forEach((entry, url) => {
				state.clientScripts.set(url, entry)
			})
		},
		handleHotUpdate: createAeroVirtualsHandleHotUpdate(state),
		configureServer: createAeroVirtualsConfigureServer(state),
		resolveId: createAeroVirtualsResolveId(state),
		load: createAeroVirtualsLoad(state),
	}
}
