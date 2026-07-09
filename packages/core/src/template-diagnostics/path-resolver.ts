/**
 * Resolve import specifiers and paths using tsconfig paths + framework defaults.
 */
import * as path from 'node:path'
import * as fs from 'node:fs'
import {
	loadTsconfigAliases,
	mergeWithDefaultAliases,
	resolveDirs,
	type ResolvedAeroDirs,
} from '../utils/aliases'
import { AERO_CONFIG_NAMES } from '../utils/aero-config'
import { loadProjectModule } from '../utils/load-project-module'
import { isExistingFile, resolveImportToFile } from './importResolution'

/** Default dirs when no aero config is available (matches framework defaults). */
const DEFAULT_DIRS: ResolvedAeroDirs = {
	client: 'client',
	server: 'server',
	dist: 'dist',
}

function loadAeroConfigDirs(root: string): ResolvedAeroDirs | undefined {
	for (const name of AERO_CONFIG_NAMES) {
		const filePath = path.join(root, name)
		if (!fs.existsSync(filePath)) continue
		try {
			const config = loadProjectModule(root, './' + name)
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

export interface PathResolver {
	resolve(specifier: string, fromFile?: string): string | undefined
	root: string
	pagesDir: string
	componentsDir: string
	layoutsDir: string
}

const resolverCache = new Map<string, PathResolver>()

function resolveAeroContentTypes(projectRoot: string): string | undefined {
	const candidate = path.join(projectRoot, 'node_modules', '@aero-js/core', 'env.d.ts')
	return isExistingFile(candidate) ? candidate : undefined
}

export function getResolver(filePath: string, workspaceRoot?: string): PathResolver {
	const docDir = path.dirname(filePath)
	const rawAliases = loadTsconfigAliases(docDir)
	const projectRoot =
		rawAliases.projectRoot ?? findAeroAppRoot(docDir, workspaceRoot) ?? workspaceRoot ?? docDir

	const cached = resolverCache.get(projectRoot)
	if (cached) return cached

	const dirs = loadAeroConfigDirs(projectRoot) ?? DEFAULT_DIRS

	const aliasResult = mergeWithDefaultAliases(rawAliases, projectRoot, dirs)
	const resolveFn = aliasResult.resolve

	const clientRoot = path.join(projectRoot, dirs.client)
	const pagesDir = path.join(clientRoot, 'pages')
	const componentsDir = path.join(clientRoot, 'components')
	const layoutsDir = path.join(clientRoot, 'layouts')

	const resolver: PathResolver = {
		root: projectRoot,
		pagesDir,
		componentsDir,
		layoutsDir,
		resolve(specifier: string, fromFile?: string): string | undefined {
			if (/^(https?:|data:|#|\/\/)/.test(specifier)) return undefined

			if (specifier === 'aero:content' || specifier.startsWith('aero:content/')) {
				return resolveAeroContentTypes(projectRoot)
			}

			const importer = fromFile ?? filePath
			const rawResolved = resolveFn(specifier, importer)
			const resolved = resolveImportToFile(specifier, rawResolved)

			return resolved && (resolved !== specifier || /^(\.{1,2}\/|\/|@|~)/.test(specifier)) ?
					resolved
				:	undefined
		},
	}

	resolverCache.set(projectRoot, resolver)
	return resolver
}

export function clearResolverCache(): void {
	resolverCache.clear()
}
