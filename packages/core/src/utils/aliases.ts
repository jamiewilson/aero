/**
 * Load TypeScript path aliases from the project's tsconfig for the Vite plugin and compiler.
 *
 * Uses `get-tsconfig` to find tsconfig.json and extract paths for Vite resolve.alias.
 * Uses `oxc-resolver` for full module resolution (tsconfig paths, extends, package exports).
 *
 * @packageDocumentation
 */

import type { UserAlias, AliasResult } from '../types'
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
	const baseUrl = options?.baseUrl || '.'
	const configDir = path.dirname(result.path || root)
	const baseDir = path.resolve(configDir, baseUrl)
	const projectRoot = configDir
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

	/** Resolve specifier from importer using oxc-resolver (tsconfig paths, extensions, package exports). */
	const resolve = (specifier: string, importer: string): string => {
		const r = resolver.resolveFileSync(importer, specifier)
		return r?.path ?? specifier
	}

	return { aliases, resolve, projectRoot }
}
