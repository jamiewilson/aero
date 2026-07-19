/**
 * Normalize Nitro config path fields relative to the user config directory.
 */

import path from 'node:path'
import { toPosix } from '../utils/path'
import { isRecord } from '../utils/is-record'

export { isRecord as isPlainObject }

function isRelativePath(value: string): boolean {
	return value.startsWith('./') || value.startsWith('../')
}

export function normalizeRelativeModulePath(value: unknown, configDir: string): unknown {
	if (typeof value !== 'string' || !isRelativePath(value)) return value
	return toPosix(path.resolve(configDir, value))
}

function mapArray(
	value: unknown,
	configDir: string,
	mapEntry: (entry: unknown, configDir: string) => unknown
): unknown {
	if (!Array.isArray(value)) return undefined
	return value.map(entry => mapEntry(entry, configDir))
}

export function normalizeScanDirs(scanDirs: unknown, configDir: string): string[] {
	if (!Array.isArray(scanDirs)) return []
	return scanDirs.map(entry => {
		if (typeof entry !== 'string' || !isRelativePath(entry)) return entry
		return toPosix(path.resolve(configDir, entry))
	}) as string[]
}

export function normalizePlugins(plugins: unknown, configDir: string): unknown {
	return mapArray(plugins, configDir, normalizeRelativeModulePath)
}

export function normalizeTasks(tasks: unknown, configDir: string): unknown {
	if (!isRecord(tasks)) return undefined

	return Object.fromEntries(
		Object.entries(tasks).map(([taskName, taskConfig]) => {
			if (!isRecord(taskConfig)) return [taskName, taskConfig]

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
	return mapArray(modules, configDir, normalizeRelativeModulePath)
}

export function normalizeImports(imports: unknown, configDir: string): unknown {
	if (!isRecord(imports)) return undefined
	const dirs = Array.isArray(imports.dirs)
		? imports.dirs.map(entry => normalizeRelativeModulePath(entry, configDir))
		: imports.dirs
	return {
		...imports,
		...(dirs !== undefined ? { dirs } : {}),
	}
}

export function normalizeAlias(alias: unknown, configDir: string): unknown {
	if (!isRecord(alias)) return undefined
	return Object.fromEntries(
		Object.entries(alias).map(([key, value]) => [
			key,
			normalizeRelativeModulePath(value, configDir),
		])
	)
}

export function normalizeAssetEntries(entries: unknown, configDir: string): unknown {
	return mapArray(entries, configDir, entry => {
		if (!isRecord(entry)) return entry
		return {
			...entry,
			dir: normalizeRelativeModulePath(entry.dir, configDir),
		}
	})
}

export function serializeInline(value: unknown): string {
	return value === undefined ? 'undefined' : JSON.stringify(value, null, 2)
}
