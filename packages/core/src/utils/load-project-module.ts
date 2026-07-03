import { createRequire } from 'node:module'
import { jitiAliasRecordFromProject } from './aliases'

const require = createRequire(import.meta.url)

export interface LoadProjectModuleOptions {
	/** When true (default), merge tsconfig path aliases into jiti resolution. */
	useAliases?: boolean
}

/**
 * Load a project file relative to `root` via jiti (sync).
 *
 * @param root - Project root used as jiti base directory.
 * @param relativePath - Path relative to root (e.g. `./aero.config.ts`).
 */
export function loadProjectModule<T = unknown>(
	root: string,
	relativePath: string,
	options: LoadProjectModuleOptions = {}
): T {
	const useAliases = options.useAliases !== false
	const alias = useAliases ? jitiAliasRecordFromProject(root) : undefined
	const jiti = require('jiti')(root, {
		esmResolve: true,
		...(alias ? { alias } : {}),
	})
	const normalized = relativePath.startsWith('./') ? relativePath : `./${relativePath}`
	const mod = jiti(normalized)
	return (mod?.default ?? mod) as T
}
