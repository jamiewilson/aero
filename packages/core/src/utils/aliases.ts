/**
 * Load TypeScript path aliases from the project's tsconfig for the Vite plugin and compiler.
 *
 * Uses `get-tsconfig` to find tsconfig.json from the given root, then reads `compilerOptions.paths`
 * and `compilerOptions.baseUrl` to build an array of { find, replacement } and an optional
 * `resolvePath(specifier)` that resolves alias prefixes to absolute paths.
 *
 * @packageDocumentation
 */

import type { UserAlias, AliasResult } from '../types'
import path from 'node:path'
import { getTsconfig } from 'get-tsconfig'

/**
 * Load path aliases from tsconfig.json at or above the given root.
 *
 * @param root - Project root directory (e.g. `process.cwd()` or Vite config root).
 * @returns AliasResult with `aliases` for Vite resolve.alias and optional `resolvePath` for compiler/resolver. Returns empty result when no tsconfig or no paths are defined.
 */
export function loadTsconfigAliases(root: string): AliasResult {
	const result = getTsconfig(root)
	if (!result) return { aliases: [], resolvePath: undefined }

	const config = result.config
	const options = config.compilerOptions
	const paths = options?.paths || {}
	const baseUrl = options?.baseUrl || '.'
	const baseDir = path.resolve(path.dirname(result.path || root), baseUrl)
	const aliases: UserAlias[] = []

	for (const [key, values] of Object.entries(paths)) {
		const valueArr = Array.from(values)
		const first = valueArr[0]
		if (typeof first !== 'string' || first.length === 0) continue

		const find = key.replace(/\/*$/, '').replace('/*', '')
		const target = first.replace(/\/*$/, '').replace('/*', '')
		const replacement = path.resolve(baseDir, target)
		aliases.push({ find, replacement })
	}

	/** Resolves a specifier (e.g. @components/header) to an absolute path using the first matching alias. */
	const resolvePath = (id: string) => {
		for (const entry of aliases) {
			if (id === entry.find || id.startsWith(`${entry.find}/`)) {
				const rest = id.slice(entry.find.length)
				return path.join(entry.replacement, rest)
			}
		}
		return id
	}

	return { aliases: aliases, resolvePath }
}
