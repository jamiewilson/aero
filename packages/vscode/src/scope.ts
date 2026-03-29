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

/** Regexes that indicate Aero template content (script is:build/is:inline/is:blocking, -component/-layout tags, data-* directives). */
const AERO_MARKERS = [
	/<script\b[^>]*\bis:(?:build|inline|blocking)\b/i,
	/<[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout)\b/i,
	/\bdata-(?:if|else-if|else|for|props)\b/,
]

/** Patterns that indicate an Aero project (in vite/tsconfig/package). */
const PROJECT_MARKERS: RegExp[] = [
	/@aero-js\//,
	/@components\/\*/,
	/@layouts\/\*/,
	/is:(?:build|inline|blocking)/,
]

const cache = new Map<string, boolean>()

/** True for file:// documents whose path ends in .html / .htm. */
export function isHtmlTemplatePath(document: vscode.TextDocument): boolean {
	if (document.uri.scheme !== 'file') return false
	const p = document.uri.fsPath.toLowerCase()
	return p.endsWith('.html') || p.endsWith('.htm')
}

/**
 * Built-in HTML language, or misclassified plaintext (some restorations leave .html as plaintext briefly).
 * Not `aero` — caller should skip switching when already aero.
 */
export function isSwitchableToAeroShell(document: vscode.TextDocument): boolean {
	const id = document.languageId
	return id === 'html' || (id === 'plaintext' && isHtmlTemplatePath(document))
}

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

/** True if document is considered an Aero template (used for providers/diagnostics). */
export function isAeroDocument(document: vscode.TextDocument): boolean {
	if (document.uri.scheme !== 'file') return false
	if (document.languageId === 'aero') return true
	if (document.languageId === 'html') {
		// continue
	} else if (document.languageId === 'plaintext' && isHtmlTemplatePath(document)) {
		// continue — same as html until we switch to aero
	} else {
		return false
	}

	const mode = getScopeMode()
	if (mode === 'always') return true

	const inProject = isInAeroProject(document.uri.fsPath)
	if (inProject) return true
	if (mode === 'strict') return false

	return hasAeroMarkers(document.getText())
}

/** True if the file is inside a detected Aero project (exported for auto-language switching). */
export function isInAeroProjectPath(filePath: string): boolean {
	return isInAeroProject(filePath)
}

/**
 * Whether to call setTextDocumentLanguage(html → aero). Aligns with isAeroDocument in auto mode
 * (project or Aero markers), plus always/strict.
 */
export function shouldSwitchToAeroLanguage(document: vscode.TextDocument): boolean {
	if (document.languageId === 'aero') return false
	if (!isHtmlTemplatePath(document) || !isSwitchableToAeroShell(document)) return false
	const mode = getScopeMode()
	if (mode === 'always') return true
	if (mode === 'strict') return isInAeroProject(document.uri.fsPath)
	return isInAeroProject(document.uri.fsPath) || hasAeroMarkers(document.getText())
}

function hasAeroMarkers(text: string): boolean {
	return AERO_MARKERS.some(pattern => pattern.test(text))
}

function isInAeroProject(filePath: string): boolean {
	const dir = path.dirname(filePath)
	const workspaceRoot = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath
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
