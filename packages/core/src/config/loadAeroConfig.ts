/**
 * Load aero.config.ts or aero.config.js from a project root (sync via jiti).
 * Used when createViteConfig() is called with no config so the app can use a single vite.config.
 */
import { AERO_CONFIG_NAMES } from '../utils/aero-config'
import { loadProjectModule } from '../utils/load-project-module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { AeroOptions, AeroOptionsFn } from '../types'

export const CONFIG_NAMES = AERO_CONFIG_NAMES

export type LoadAeroConfigDetailedResult =
	| { ok: true; filePath: string; config: AeroOptions | AeroOptionsFn }
	| { ok: false; reason: 'not-found' }
	| { ok: false; reason: 'invalid-export'; filePath: string }
	| { ok: false; reason: 'load-error'; filePath: string; error: unknown }

/**
 * Detailed config-load result used by strict/effect pipelines.
 * Preserves file path and underlying load error when loading fails.
 */
export function loadAeroConfigDetailed(root: string): LoadAeroConfigDetailedResult {
	let lastFailure: Extract<LoadAeroConfigDetailedResult, { ok: false }> | null = null
	for (const name of CONFIG_NAMES) {
		const filePath = path.join(root, name)
		if (!existsSync(filePath)) continue
		try {
			const config = loadProjectModule<AeroOptions | AeroOptionsFn>(root, './' + name)
			if (config && (typeof config === 'object' || typeof config === 'function')) {
				return { ok: true, filePath, config }
			}
			lastFailure = { ok: false, reason: 'invalid-export', filePath }
		} catch (error) {
			lastFailure = { ok: false, reason: 'load-error', filePath, error }
		}
	}
	if (lastFailure) return lastFailure
	return { ok: false, reason: 'not-found' }
}

/**
 * Load aero config from project root if present.
 *
 * @param root - Project root (e.g. process.cwd() when vite.config runs).
 * @returns Resolved `AeroOptions` or `AeroOptionsFn`, or null if no file found or load failed.
 */
export function loadAeroConfig(root: string): AeroOptions | AeroOptionsFn | null {
	const detailed = loadAeroConfigDetailed(root)
	if (detailed.ok) return detailed.config
	if (process.env.DEBUG?.includes('aero') && detailed.reason !== 'not-found') {
		if (detailed.reason === 'load-error') {
			console.error('[aero] loadAeroConfig failed for', detailed.filePath, detailed.error)
		} else {
			console.error(
				'[aero] loadAeroConfig invalid export for',
				detailed.filePath,
				'(expected object or function)'
			)
		}
	}
	return null
}
