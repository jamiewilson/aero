/**
 * Resolve import specifiers and paths using tsconfig paths + framework defaults.
 *
 * @remarks
 * Uses loadTsconfigAliases and mergeWithDefaultAliases from @aero-js/core/utils/aliases so
 * @pages, @layouts, @components resolve even when tsconfig is missing or has no paths.
 * When no tsconfig, tries to load aero.config.ts for custom dirs (e.g. frontend/).
 * Caches a PathResolver per project root. Used by definition, hover, and completion providers.
 */
import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import {
	loadTsconfigAliases,
	mergeWithDefaultAliases,
	resolveDirs,
	type ResolvedAeroDirs,
} from '@aero-js/core/utils/aliases'

const require = createRequire(import.meta.url)

/** Default dirs when no aero config is available (matches framework defaults). */
const DEFAULT_DIRS: ResolvedAeroDirs = {
	client: 'client',
	server: 'server',
	dist: 'dist',
}

const AERO_CONFIG_NAMES = ['aero.config.ts', 'aero.config.js', 'aero.config.mjs'] as const

/**
 * Load dirs from aero.config at root if present.
 * Returns undefined if no config found or load fails.
 */
function loadAeroConfigDirs(root: string): ResolvedAeroDirs | undefined {
	for (const name of AERO_CONFIG_NAMES) {
		const filePath = path.join(root, name)
		if (!fs.existsSync(filePath)) continue
		try {
			const jiti = require('jiti')(root, { esmResolve: true })
			const mod = jiti('./' + name)
			const config = mod?.default ?? mod
			if (!config || (typeof config !== 'object' && typeof config !== 'function')) continue
			const resolved =
				typeof config === 'function' ? config({ command: 'dev', mode: 'development' }) : config
			const dirs = resolved?.dirs
			if (dirs && typeof dirs === 'object') {
				return resolveDirs(dirs)
			}
		} catch {
			// Load failed; try next extension
		}
	}
	return undefined
}

/**
 * Find the nearest Aero app root: directory containing client/, frontend/, or aero.config.
 * Used for nested apps (e.g. examples/import-bundling/dynamic-import) in a monorepo.
 */
function findAeroAppRoot(startDir: string, workspaceRoot?: string): string | undefined {
	let current = startDir
	const fsRoot = path.parse(current).root
	const stopAt = workspaceRoot ? path.resolve(workspaceRoot) : fsRoot

	while (current !== stopAt && current !== fsRoot) {
		if (fs.existsSync(path.join(current, 'client'))) return current
		if (fs.existsSync(path.join(current, 'frontend'))) return current
		for (const name of AERO_CONFIG_NAMES) {
			if (fs.existsSync(path.join(current, name))) return current
		}
		current = path.dirname(current)
	}
	return undefined
}
const RESOLUTION_EXTENSIONS = ['.html', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']

export interface PathResolver {
	/** Resolve an alias-prefixed or relative specifier to an absolute file path. */
	resolve(specifier: string, fromFile?: string): string | undefined
	/** The project root (directory containing tsconfig.json or workspace root). */
	root: string
	/** Resolved `client`/frontend root + `components` (respects aero.config dirs). */
	componentsDir: string
	/** Resolved `client`/frontend root + `layouts`. */
	layoutsDir: string
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
	const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
	const projectRoot =
		rawAliases.projectRoot ?? findAeroAppRoot(docDir, workspaceRoot) ?? workspaceRoot ?? docDir

	const cached = resolverCache.get(projectRoot)
	if (cached) return cached

	// Try aero.config for custom dirs (e.g. frontend/ instead of client/) when no tsconfig or for defaults
	const dirs = loadAeroConfigDirs(projectRoot) ?? DEFAULT_DIRS

	const aliasResult = mergeWithDefaultAliases(rawAliases, projectRoot, dirs)
	const resolveFn = aliasResult.resolve

	const clientRoot = path.join(projectRoot, dirs.client)
	const componentsDir = path.join(clientRoot, 'components')
	const layoutsDir = path.join(clientRoot, 'layouts')

	const resolver: PathResolver = {
		root: projectRoot,
		componentsDir,
		layoutsDir,
		resolve(specifier: string, fromFile?: string): string | undefined {
			if (/^(https?:|data:|#|\/\/)/.test(specifier)) return undefined

			const importer = fromFile ?? document.uri.fsPath
			const rawResolved = resolveFn(specifier, importer)
			const resolved = resolveToExistingPath(rawResolved)
			return resolved !== specifier || /^(\.{1,2}\/|\/|@|~)/.test(specifier) ? resolved : undefined
		},
	}

	resolverCache.set(projectRoot, resolver)
	return resolver
}

/** Clear the resolver cache (e.g. when tsconfig changes). */
export function clearResolverCache(): void {
	resolverCache.clear()
}

function resolveToExistingPath(candidate: string): string {
	if (!candidate) return candidate
	if (fs.existsSync(candidate)) return candidate

	for (const ext of RESOLUTION_EXTENSIONS) {
		const withExt = `${candidate}${ext}`
		if (fs.existsSync(withExt)) return withExt
	}

	for (const ext of RESOLUTION_EXTENSIONS) {
		const indexPath = path.join(candidate, `index${ext}`)
		if (fs.existsSync(indexPath)) return indexPath
	}

	return candidate
}
