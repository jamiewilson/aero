/**
 * Load aero.config.ts or aero.config.js from a project root (sync via jiti).
 * Used when createViteConfig() is called with no config so the app can use a single vite.config.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { AeroConfig, AeroConfigFunction } from './types'

const require = createRequire(import.meta.url)

const CONFIG_NAMES = ['aero.config.ts', 'aero.config.js', 'aero.config.mjs'] as const

/**
 * Load aero config from project root if present.
 *
 * @param root - Project root (e.g. process.cwd() when vite.config runs).
 * @returns Resolved AeroConfig or AeroConfigFunction, or null if no file found or load failed.
 */
export function loadAeroConfig(root: string): AeroConfig | AeroConfigFunction | null {
	for (const name of CONFIG_NAMES) {
		const filePath = path.join(root, name)
		if (!existsSync(filePath)) continue
		try {
			// jiti(projectRoot) uses projectRoot as base for resolving; pass relative path from root
			const jiti = require('jiti')(root, { esmResolve: true })
			const relativePath = './' + name
			const mod = jiti(relativePath)
			const config = mod?.default ?? mod
			if (config && (typeof config === 'object' || typeof config === 'function')) {
				return config as AeroConfig | AeroConfigFunction
			}
		} catch (err) {
			// Load failed (e.g. resolve error); try next extension
			if (process.env.DEBUG?.includes('aero')) {
				console.error('[createViteConfig] loadAeroConfig failed for', filePath, err)
			}
		}
	}
	return null
}
