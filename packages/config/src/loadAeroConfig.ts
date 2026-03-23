/**
 * Load aero.config.ts or aero.config.js from a project root (sync via jiti).
 * Used when createViteConfig() is called with no config so the app can use a single vite.config.
 */
import { jitiAliasRecordFromProject } from '@aero-js/core/utils/aliases'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { AeroConfig, AeroConfigFunction } from './types'

const require = createRequire(import.meta.url)

export const CONFIG_NAMES = ['aero.config.ts', 'aero.config.js', 'aero.config.mjs'] as const

export type LoadAeroConfigDetailedResult =
	| { ok: true; filePath: string; config: AeroConfig | AeroConfigFunction }
	| { ok: false; reason: 'not-found' }
	| { ok: false; reason: 'invalid-export'; filePath: string }
	| { ok: false; reason: 'load-error'; filePath: string; error: unknown }

/**
 * Detailed config-load result used by strict/effect pipelines.
 * Preserves file path and underlying load error when loading fails.
 */
export function loadAeroConfigDetailed(root: string): LoadAeroConfigDetailedResult {
	let sawFile = false
	for (const name of CONFIG_NAMES) {
		const filePath = path.join(root, name)
		if (!existsSync(filePath)) continue
		sawFile = true
		try {
			// jiti(projectRoot) uses projectRoot as base for resolving; pass relative path from root
			const alias = jitiAliasRecordFromProject(root)
			const jiti = require('jiti')(root, { esmResolve: true, alias })
			const relativePath = './' + name
			const mod = jiti(relativePath)
			const config = mod?.default ?? mod
			if (config && (typeof config === 'object' || typeof config === 'function')) {
				return { ok: true, filePath, config: config as AeroConfig | AeroConfigFunction }
			}
			return { ok: false, reason: 'invalid-export', filePath }
		} catch (error) {
			return { ok: false, reason: 'load-error', filePath, error }
		}
	}
	if (!sawFile) {
		return { ok: false, reason: 'not-found' }
	}
	return { ok: false, reason: 'not-found' }
}

/**
 * Load aero config from project root if present.
 *
 * @param root - Project root (e.g. process.cwd() when vite.config runs).
 * @returns Resolved AeroConfig or AeroConfigFunction, or null if no file found or load failed.
 */
export function loadAeroConfig(root: string): AeroConfig | AeroConfigFunction | null {
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
