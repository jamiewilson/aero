import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { RESOLVE_EXTENSIONS } from './constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Alias {
	find: string
	replacement: string
}

export interface PathResolver {
	/** Resolve an alias-prefixed or relative specifier to an absolute file path. */
	resolve(specifier: string, fromFile?: string): string | undefined
	/** The project root (directory containing tsconfig.json). */
	root: string
}

// ---------------------------------------------------------------------------
// Tsconfig discovery and parsing
// ---------------------------------------------------------------------------

/**
 * Walk up from `startDir` to find the nearest tsconfig.json.
 * Returns the parsed compilerOptions.paths and the base directory, or null.
 */
function findTsconfig(startDir: string): {
	tsconfigPath: string
	paths: Record<string, string[]>
	baseDir: string
} | null {
	let dir = startDir
	const root = path.parse(dir).root

	while (dir !== root) {
		const candidate = path.join(dir, 'tsconfig.json')
		if (fs.existsSync(candidate)) {
			try {
				const raw = fs.readFileSync(candidate, 'utf-8')
				// Strip single-line comments for lenient JSON parsing
				const stripped = raw.replace(/\/\/.*$/gm, '')
				const config = JSON.parse(stripped)
				const options = config.compilerOptions || {}
				const paths: Record<string, string[]> = options.paths || {}
				const baseUrl: string = options.baseUrl || '.'
				const baseDir = path.resolve(path.dirname(candidate), baseUrl)
				return { tsconfigPath: candidate, paths, baseDir }
			} catch {
				// Failed to parse; keep walking
			}
		}
		dir = path.dirname(dir)
	}
	return null
}

// ---------------------------------------------------------------------------
// Build alias list from tsconfig paths
// ---------------------------------------------------------------------------

function buildAliases(paths: Record<string, string[]>, baseDir: string): Alias[] {
	const aliases: Alias[] = []
	for (const [key, values] of Object.entries(paths)) {
		const first = values[0]
		if (typeof first !== 'string' || first.length === 0) continue

		const find = key.replace(/\/*$/, '').replace('/*', '')
		const target = first.replace(/\/*$/, '').replace('/*', '')
		const replacement = path.resolve(baseDir, target)
		aliases.push({ find, replacement })
	}
	return aliases
}

// ---------------------------------------------------------------------------
// Create resolver for a given document
// ---------------------------------------------------------------------------

const resolverCache = new Map<string, PathResolver>()

/**
 * Get or create a PathResolver for the workspace containing the given document.
 * Caches by project root so tsconfig is only read once per root.
 */
export function getResolver(document: vscode.TextDocument): PathResolver | undefined {
	const docDir = path.dirname(document.uri.fsPath)
	const tsconfig = findTsconfig(docDir)

	if (!tsconfig) {
		// No tsconfig -- return a minimal resolver that can only handle relative paths
		return {
			root: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || docDir,
			resolve(specifier: string, fromFile?: string) {
				return resolveRelative(specifier, fromFile || document.uri.fsPath, this.root)
			},
		}
	}

	const projectRoot = path.dirname(tsconfig.tsconfigPath)
	const cached = resolverCache.get(projectRoot)
	if (cached) return cached

	const aliases = buildAliases(tsconfig.paths, tsconfig.baseDir)

	const resolver: PathResolver = {
		root: projectRoot,
		resolve(specifier: string, fromFile?: string) {
			// Skip URLs, hashes, data URIs
			if (/^(https?:|data:|#|\/\/)/.test(specifier)) return undefined

			// Try alias resolution
			for (const alias of aliases) {
				if (specifier === alias.find || specifier.startsWith(`${alias.find}/`)) {
					const rest = specifier.slice(alias.find.length)
					const resolved = path.join(alias.replacement, rest)
					return resolveWithExtensions(resolved)
				}
			}

			// Relative or absolute paths
			return resolveRelative(specifier, fromFile || document.uri.fsPath, projectRoot)
		},
	}

	resolverCache.set(projectRoot, resolver)
	return resolver
}

/**
 * Clear the resolver cache (e.g. when tsconfig changes).
 */
export function clearResolverCache(): void {
	resolverCache.clear()
}

// ---------------------------------------------------------------------------
// Resolve helpers
// ---------------------------------------------------------------------------

function resolveRelative(
	specifier: string,
	fromFile: string,
	projectRoot: string,
): string | undefined {
	let resolved: string

	if (specifier.startsWith('./') || specifier.startsWith('../')) {
		resolved = path.resolve(path.dirname(fromFile), specifier)
	} else if (specifier.startsWith('/')) {
		resolved = path.resolve(projectRoot, specifier.slice(1))
	} else {
		// Bare specifier -- can't resolve without alias
		return undefined
	}

	return resolveWithExtensions(resolved)
}

/**
 * If `resolved` exists as-is, return it. Otherwise try adding common extensions.
 */
function resolveWithExtensions(resolved: string): string | undefined {
	// Exact path
	if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
		return resolved
	}

	// Try with extensions
	for (const ext of RESOLVE_EXTENSIONS) {
		const withExt = resolved + ext
		if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
			return withExt
		}
	}

	// Try as directory with index file
	for (const ext of RESOLVE_EXTENSIONS) {
		const indexFile = path.join(resolved, `index${ext}`)
		if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
			return indexFile
		}
	}

	// Return the resolved path even if it doesn't exist yet (allows "go to" for files
	// that will be created, and VS Code will show a "file not found" experience)
	return resolved
}
