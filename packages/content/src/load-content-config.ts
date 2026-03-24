/**
 * Load `content.config.ts` (or a custom path) with jiti + project aliases.
 *
 * @remarks
 * Shared by the Vite content plugin and `aero check` so behavior stays aligned.
 */
import type { ContentConfig } from './types'
import { jitiAliasRecordFromProject } from '@aero-js/core/utils/aliases'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

export type LoadContentConfigResult =
	| { ok: true; config: ContentConfig }
	| { ok: false; reason: 'missing' }
	| { ok: false; reason: 'error'; error: unknown }

/**
 * Synchronously load the content collections config file from the project root.
 *
 * @param root - Project root (Vite root).
 * @param configFile - Path relative to root or absolute (default in plugin: `content.config.ts`).
 */
export function loadContentConfigFileSync(
	root: string,
	configFile: string
): LoadContentConfigResult {
	const configPath = path.isAbsolute(configFile) ? configFile : path.resolve(root, configFile)
	if (!existsSync(configPath)) {
		return { ok: false, reason: 'missing' }
	}
	try {
		const alias = jitiAliasRecordFromProject(root)
		const jiti = require('jiti')(root, { esmResolve: true, alias })
		const relativePath = './' + path.relative(root, configPath).replace(/\\/g, '/')
		const mod = jiti(relativePath)
		const config = (mod?.default ?? mod) as ContentConfig
		return { ok: true, config }
	} catch (error) {
		return { ok: false, reason: 'error', error }
	}
}
