/**
 * Load TypeScript path aliases from the project's tsconfig for the Vite plugin and compiler.
 *
 * Uses `get-tsconfig` to find tsconfig.json and extract paths for Vite resolve.alias.
 * Uses `oxc-resolver` for full module resolution (tsconfig paths, extends, package exports).
 * Framework defaults for @pages, @layouts, @components, @styles, @scripts, @images, @content can be merged via mergeWithDefaultAliases.
 *
 * @packageDocumentation
 */

import type { AeroDirs, UserAlias, AliasResult } from '../types'
import { resolveDirs, type ResolvedAeroDirs } from '../vite/defaults'
import path from 'node:path'
import { getTsconfig } from 'get-tsconfig'
import { ResolverFactory } from 'oxc-resolver'

const AERO_EXTENSIONS = ['.html', '.ts', '.js', '.json', '.node']

/** Shared oxc-resolver instance for Aero resolution (tsconfig auto, ESM, .html support). */
const resolver = new ResolverFactory({
	extensions: AERO_EXTENSIONS,
	conditionNames: ['node', 'import'],
	tsconfig: 'auto',
})

/**
 * Build default path aliases for standard Aero paths from project root and dirs.
 * Used when tsconfig is missing or does not define these keys so path resolution works without tsconfig.
 */
export function getDefaultAliases(root: string, dirs: ResolvedAeroDirs): UserAlias[] {
	const client = dirs.client
	return [
		{ find: '@pages', replacement: path.join(root, client, 'pages') },
		{ find: '@layouts', replacement: path.join(root, client, 'layouts') },
		{ find: '@components', replacement: path.join(root, client, 'components') },
		{ find: '@styles', replacement: path.join(root, client, 'assets', 'styles') },
		{ find: '@scripts', replacement: path.join(root, client, 'assets', 'scripts') },
		{ find: '@images', replacement: path.join(root, client, 'assets', 'images') },
		{ find: '@content', replacement: path.join(root, 'content') },
	]
}

/**
 * Load path aliases from tsconfig.json at or above the given root.
 *
 * @param root - Project root directory (e.g. `process.cwd()` or Vite config root).
 * @returns AliasResult with `aliases` for Vite resolve.alias and `resolve(specifier, importer)` for compiler/build.
 */
export function loadTsconfigAliases(root: string): AliasResult {
	const result = getTsconfig(root)
	if (!result) {
		return {
			aliases: [],
			resolve: (specifier, importer) => {
				const r = resolver.resolveFileSync(importer, specifier)
				return r?.path ?? specifier
			},
			projectRoot: undefined,
		}
	}

	const config = result.config
	const options = config.compilerOptions
	const paths = options?.paths || {}
	const configDir = path.dirname(result.path || root)
	const projectRoot = configDir
	const aliases: UserAlias[] = []

	for (const [key, values] of Object.entries(paths)) {
		const valueArr = Array.from(values)
		const first = valueArr[0]
		if (typeof first !== 'string' || first.length === 0) continue

		const find = key.replace(/\/*$/, '').replace('/*', '')
		const target = first.replace(/\/*$/, '').replace('/*', '')
		const replacement = path.resolve(configDir, target)
		aliases.push({ find, replacement })
	}

	/** Resolve specifier from importer using oxc-resolver (tsconfig paths, extensions, package exports). */
	const resolve = (specifier: string, importer: string): string => {
		const r = resolver.resolveFileSync(importer, specifier)
		return r?.path ?? specifier
	}

	return { aliases, resolve, projectRoot }
}

/**
 * Merge framework default aliases (from dirs) with tsconfig-derived aliases.
 * Defaults are applied first; any alias from aliasResult with the same `find` overwrites.
 * Produces a resolve that tries merged aliases first, then falls back to the original resolver.
 *
 * Ensures standard path aliases always exist so the runtime import.meta.glob patterns and asset resolution work.
 *
 * @param aliasResult - Result from loadTsconfigAliases (may have empty aliases when no tsconfig).
 * @param root - Project root.
 * @param dirs - Resolved client/layouts/components dirs.
 * @returns AliasResult with merged aliases and a resolve that uses them.
 */
export function mergeWithDefaultAliases(
	aliasResult: AliasResult,
	root: string,
	dirs: ResolvedAeroDirs
): AliasResult {
	const defaults = getDefaultAliases(root, dirs)
	const byFind = new Map<string, string>()
	for (const a of defaults) {
		byFind.set(a.find, a.replacement)
	}
	for (const a of aliasResult.aliases) {
		byFind.set(a.find, a.replacement)
	}
	const aliases: UserAlias[] = Array.from(byFind.entries()).map(([find, replacement]) => ({
		find,
		replacement,
	}))

	const resolve = (specifier: string, importer: string): string => {
		for (const { find, replacement } of aliases) {
			if (specifier === find || specifier.startsWith(find + '/')) {
				const rest = specifier.slice(find.length)
				const resolved = path.join(replacement, rest.replace(/^\//, ''))
				return resolved
			}
		}
		return aliasResult.resolve(specifier, importer)
	}

	return {
		aliases,
		resolve,
		projectRoot: aliasResult.projectRoot,
	}
}

/**
 * Build the `alias` option for jiti when loading project config files (`aero.config.ts`, `content.config.ts`).
 * Uses the same merged tsconfig paths + Aero defaults as Vite {@link mergeWithDefaultAliases}.
 *
 * @param root - Project root (tsconfig discovery).
 * @param dirs - Optional Aero directory overrides; defaults match {@link resolveDirs}.
 */
export function jitiAliasRecordFromProject(root: string, dirs?: AeroDirs): Record<string, string> {
	const resolvedDirs = resolveDirs(dirs)
	const merged = mergeWithDefaultAliases(loadTsconfigAliases(root), root, resolvedDirs)
	return Object.fromEntries(merged.aliases.map((a: UserAlias) => [a.find, a.replacement]))
}

export { resolveDirs, type ResolvedAeroDirs }
