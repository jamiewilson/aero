/**
 * Scope detection: whether a document is treated as an Aero template (for providers and diagnostics).
 *
 * @remarks
 * Uses `aero.scopeMode`: `auto` (markers or in-Aero project), `strict` (only in-Aero project), `always` (all HTML).
 * Caches "is this dir in an Aero project?" per workspace root + dir to avoid repeated filesystem scans.
 */
import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'

/** When to treat an HTML file as an Aero document: auto (markers or project), strict (project only), always (all HTML). */
export type AeroScopeMode = 'auto' | 'strict' | 'always'

const CONFIG_SECTION = 'aero'
const CONFIG_SCOPE_MODE = 'scopeMode'

/** Regexes that indicate Aero template content (script on:build/on:client, -component/-layout tags, data-* directives). */
const AERO_MARKERS = [
	/<script\b[^>]*\bon:(?:build|client)\b/i,
	/<[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout)\b/i,
	/\bdata-(?:if|else-if|else|each|props)\b/,
]

/** Patterns that indicate an Aero project (in vite/tsconfig/package). */
const PROJECT_MARKERS: RegExp[] = [
	/@aero-ssg/,
	/@components\/\*/,
	/@layouts\/\*/,
	/on:(?:build|client)/,
]

const cache = new Map<string, boolean>()

/** Clear the "is Aero project" cache (e.g. when tsconfig changes). */
export function clearScopeCache(): void {
	cache.clear()
}

/** Current `aero.scopeMode` from workspace config (auto | strict | always). */
export function getScopeMode(): AeroScopeMode {
	const value = vscode.workspace
		.getConfiguration(CONFIG_SECTION)
		.get<string>(CONFIG_SCOPE_MODE, 'auto')
	if (value === 'strict' || value === 'always') return value
	return 'auto'
}

/** True if document is considered an Aero template (used by providers/diagnostics). */
export function isAeroDocument(document: vscode.TextDocument): boolean {
	if (document.languageId !== 'html' || document.uri.scheme !== 'file') return false

	const mode = getScopeMode()
	if (mode === 'always') return true

	if (isInAeroProject(document.uri.fsPath)) return true
	if (mode === 'strict') return false

	return hasAeroMarkers(document.getText())
}

function hasAeroMarkers(text: string): boolean {
	return AERO_MARKERS.some(pattern => pattern.test(text))
}

function isInAeroProject(filePath: string): boolean {
	const dir = path.dirname(filePath)
	const workspaceRoot = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri
		.fsPath
	const key = workspaceRoot ? `${workspaceRoot}::${dir}` : dir
	const cached = cache.get(key)
	if (cached !== undefined) return cached

	const result = scanUpForProjectMarkers(dir, workspaceRoot)
	cache.set(key, result)
	return result
}

function scanUpForProjectMarkers(startDir: string, workspaceRoot?: string): boolean {
	let current = startDir
	const fsRoot = path.parse(current).root
	const stopAt = workspaceRoot ? path.resolve(workspaceRoot) : fsRoot

	while (true) {
		if (directoryLooksLikeAero(current)) return true
		if (current === stopAt || current === fsRoot) break
		current = path.dirname(current)
	}

	if (workspaceRoot && workspaceRoot !== stopAt && directoryLooksLikeAero(workspaceRoot)) {
		return true
	}

	return false
}

function directoryLooksLikeAero(dir: string): boolean {
	for (const viteName of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
		if (fileContains(path.join(dir, viteName), PROJECT_MARKERS)) return true
	}

	if (fileContains(path.join(dir, 'tsconfig.json'), PROJECT_MARKERS)) return true
	if (fileContains(path.join(dir, 'package.json'), PROJECT_MARKERS)) return true

	return false
}

function fileContains(filePath: string, patterns: RegExp[]): boolean {
	try {
		if (!fs.existsSync(filePath)) return false
		const content = fs.readFileSync(filePath, 'utf-8')
		return patterns.some(pattern => pattern.test(content))
	} catch {
		return false
	}
}
