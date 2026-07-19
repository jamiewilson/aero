/**
 * Load aero.config.* and resolve dirs + feature flags for tooling (diagnostics, path resolver).
 */

import { loadAeroConfig } from './loadAeroConfig'
import { resolveDirs, type ResolvedAeroDirs } from '../vite/defaults'
import type { AeroOptions } from '../types'

export interface ResolvedAeroConfig {
	options: AeroOptions | null
	dirs: ResolvedAeroDirs
	flags: { reactivity: boolean; hypermedia: boolean }
}

/**
 * Sync-load project aero config and return resolved dirs/flags.
 * Function configs are invoked with `{ command: 'dev', mode: 'development' }`.
 */
export function loadResolvedAeroConfig(root: string): ResolvedAeroConfig {
	const loaded = loadAeroConfig(root)
	if (!loaded) {
		return {
			options: null,
			dirs: resolveDirs(),
			flags: { reactivity: false, hypermedia: false },
		}
	}
	const options =
		typeof loaded === 'function' ? loaded({ command: 'dev', mode: 'development' }) : loaded
	if (!options || typeof options !== 'object') {
		return {
			options: null,
			dirs: resolveDirs(),
			flags: { reactivity: false, hypermedia: false },
		}
	}
	return {
		options,
		dirs: resolveDirs(options.dirs),
		flags: {
			reactivity: options.reactivity === true,
			hypermedia: options.hypermedia === true,
		},
	}
}
