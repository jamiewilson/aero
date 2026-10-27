import { createRequire } from 'node:module'
import { jitiAliasRecordFromProject } from './aliases'

const require = createRequire(import.meta.url)

/** Resolve optional framework deps for jiti when the project root has no node_modules (e.g. temp dirs in tests). */
function frameworkModuleAliasesForJiti(): Record<string, string> {
	const requireFromCore = createRequire(import.meta.url)
	const aliases: Record<string, string> = {}
	for (const specifier of ['nitro/config', 'nitro'] as const) {
		try {
			aliases[specifier] = requireFromCore.resolve(specifier)
		} catch {
			// nitro optional outside server projects
		}
	}
	return aliases
}

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
	const projectAlias = useAliases ? jitiAliasRecordFromProject(root) : undefined
	const alias = { ...frameworkModuleAliasesForJiti(), ...projectAlias }
	const jiti = require('jiti')(root, {
		esmResolve: true,
		...(Object.keys(alias).length > 0 ? { alias } : {}),
	})
	const normalized = relativePath.startsWith('./') ? relativePath : `./${relativePath}`
	const mod = jiti(normalized)
	return (mod?.default ?? mod) as T
}
