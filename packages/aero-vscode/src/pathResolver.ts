/**
 * Resolve import specifiers and paths using tsconfig paths + framework defaults.
 *
 * @remarks
 * Uses loadTsconfigAliases and mergeWithDefaultAliases from @aerobuilt/core/utils/aliases so
 * @pages, @layouts, @components resolve even when tsconfig is missing or has no paths.
 * Caches a PathResolver per project root. Used by definition, hover, and completion providers.
 */
import * as vscode from 'vscode'
import * as path from 'node:path'
import {
	loadTsconfigAliases,
	mergeWithDefaultAliases,
} from '@aerobuilt/core/utils/aliases'

/** Default dirs when no aero/vite config is available (matches framework defaults). */
const DEFAULT_DIRS = { client: 'client', server: 'server', dist: 'dist' }

export interface PathResolver {
	/** Resolve an alias-prefixed or relative specifier to an absolute file path. */
	resolve(specifier: string, fromFile?: string): string | undefined
	/** The project root (directory containing tsconfig.json or workspace root). */
	root: string
}

const resolverCache = new Map<string, PathResolver>()

/**
 * Get or create a PathResolver for the document's workspace. Caches by project root.
 *
 * @param document - Text document (used for path and workspace folder).
 * @returns PathResolver for the document's project.
 */
export function getResolver(document: vscode.TextDocument): PathResolver {
	const docDir = path.dirname(document.uri.fsPath)
	const rawAliases = loadTsconfigAliases(docDir)

	const projectRoot =
		rawAliases.projectRoot ??
		vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ??
		docDir

	const cached = resolverCache.get(projectRoot)
	if (cached) return cached

	const aliasResult = mergeWithDefaultAliases(rawAliases, projectRoot, DEFAULT_DIRS)
	const resolveFn = aliasResult.resolve

	const resolver: PathResolver = {
		root: projectRoot,
		resolve(specifier: string, fromFile?: string): string | undefined {
			if (/^(https?:|data:|#|\/\/)/.test(specifier)) return undefined

			const importer = fromFile ?? document.uri.fsPath
			const resolved = resolveFn(specifier, importer)
			return resolved !== specifier || /^(\.{1,2}\/|\/|@|~)/.test(specifier)
				? resolved
				: undefined
		},
	}

	resolverCache.set(projectRoot, resolver)
	return resolver
}

/** Clear the resolver cache (e.g. when tsconfig changes). */
export function clearResolverCache(): void {
	resolverCache.clear()
}
