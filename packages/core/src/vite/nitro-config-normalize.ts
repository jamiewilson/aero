/**
 * Normalize Nitro config path fields relative to the user config directory.
 */

import path from 'node:path'
import { toPosix } from '../utils/path'

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRelativePath(value: string): boolean {
	return value.startsWith('./') || value.startsWith('../')
}

export function normalizeRelativeModulePath(value: unknown, configDir: string): unknown {
	if (typeof value !== 'string' || !isRelativePath(value)) return value
	return toPosix(path.resolve(configDir, value))
}

export function normalizeScanDirs(scanDirs: unknown, configDir: string): string[] {
	if (!Array.isArray(scanDirs)) return []
	return scanDirs.map(entry => {
		if (typeof entry !== 'string' || !isRelativePath(entry)) return entry
		return toPosix(path.resolve(configDir, entry))
	})
}

export function normalizePlugins(plugins: unknown, configDir: string): unknown {
	if (!Array.isArray(plugins)) return undefined
	return plugins.map(entry => normalizeRelativeModulePath(entry, configDir))
}

export function normalizeTasks(tasks: unknown, configDir: string): unknown {
	if (!isPlainObject(tasks)) return undefined

	return Object.fromEntries(
		Object.entries(tasks).map(([taskName, taskConfig]) => {
			if (!isPlainObject(taskConfig)) return [taskName, taskConfig]

			return [
				taskName,
				{
					...taskConfig,
					handler: normalizeRelativeModulePath(taskConfig.handler, configDir),
				},
			]
		})
	)
}

export function normalizeModules(modules: unknown, configDir: string): unknown {
	if (!Array.isArray(modules)) return undefined
	return modules.map(entry => normalizeRelativeModulePath(entry, configDir))
}

export function normalizeImports(imports: unknown, configDir: string): unknown {
	if (!isPlainObject(imports)) return undefined
	const dirs = Array.isArray(imports.dirs)
		? imports.dirs.map(entry => normalizeRelativeModulePath(entry, configDir))
		: imports.dirs
	return {
		...imports,
		...(dirs !== undefined ? { dirs } : {}),
	}
}

export function normalizeAlias(alias: unknown, configDir: string): unknown {
	if (!isPlainObject(alias)) return undefined
	return Object.fromEntries(
		Object.entries(alias).map(([key, value]) => [
			key,
			normalizeRelativeModulePath(value, configDir),
		])
	)
}

export function normalizeAssetEntries(entries: unknown, configDir: string): unknown {
	if (!Array.isArray(entries)) return undefined
	return entries.map(entry => {
		if (!isPlainObject(entry)) return entry
		return {
			...entry,
			dir: normalizeRelativeModulePath(entry.dir, configDir),
		}
	})
}

export function serializeInline(value: unknown): string {
	return value === undefined ? 'undefined' : JSON.stringify(value, null, 2)
}
