/**
 * Aero project detection + language-switch gating.
 *
 * @remarks
 * The extension only switches `.html` / `.htm` to `aero` when the file is inside a
 * detected Aero project. Detection uses the nearest project root candidate and strong
 * signals only (`aero.config.*`, `vite.config.*`, `package.json`).
 */
import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'

type ScopeLogFn = (message: string) => void

const cache = new Map<string, boolean>()
let scopeLogger: ScopeLogFn | undefined

const AERO_CONFIG_FILES = ['aero.config.ts', 'aero.config.js', 'aero.config.mts', 'aero.config.mjs']
const VITE_CONFIG_FILES = ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs']

const ROOT_CANDIDATE_FILES = ['package.json', ...AERO_CONFIG_FILES, ...VITE_CONFIG_FILES]

const AERO_CONFIG_PATTERNS: RegExp[] = [/@aero-js\/config/, /\bdefineConfig\s*\(/]
const VITE_CONFIG_PATTERNS: RegExp[] = [/@aero-js\/vite/, /aero\.config\.(?:ts|js|mts|mjs)/]
const PACKAGE_PATTERNS: RegExp[] = [/@aero-js\//]

export function setScopeDebugLogger(logger: ScopeLogFn | undefined): void {
	scopeLogger = logger
}

/** True for file:// documents whose path ends in .html / .htm. */
export function isHtmlTemplatePath(document: vscode.TextDocument): boolean {
	if (document.uri.scheme !== 'file') return false
	const p = document.uri.fsPath.toLowerCase()
	return p.endsWith('.html') || p.endsWith('.htm')
}

/** Built-in HTML shell language IDs we can switch from. */
export function isSwitchableToAeroShell(document: vscode.TextDocument): boolean {
	const id = document.languageId
	return id === 'html' || (id === 'plaintext' && isHtmlTemplatePath(document))
}

/** Clear project-detection cache (e.g. on config change). */
export function clearScopeCache(): void {
	cache.clear()
}

/** Provider/diagnostics gate: Aero-only to avoid touching plain HTML behavior. */
export function isAeroDocument(document: vscode.TextDocument): boolean {
	return document.uri.scheme === 'file' && document.languageId === 'aero'
}

/** True if a file path is inside a detected Aero project (nearest-root semantics). */
export function isInAeroProjectPath(filePath: string): boolean {
	return isInAeroProject(filePath)
}

/** Whether to switch html/plaintext(.html) → aero for this document. */
export function shouldSwitchToAeroLanguage(document: vscode.TextDocument): boolean {
	const pathText = document.uri.fsPath || document.uri.toString()

	if (document.languageId === 'aero') return false
	if (!isHtmlTemplatePath(document)) return false
	if (!isSwitchableToAeroShell(document)) {
		scopeLogger?.(`switch skip: non-switchable languageId=${document.languageId} (${pathText})`)
		return false
	}

	const inProject = isInAeroProject(document.uri.fsPath)
	scopeLogger?.(`switch decision: ${inProject ? 'switch' : 'no-switch'} (${pathText})`)
	return inProject
}

function isInAeroProject(filePath: string): boolean {
	const dir = path.dirname(filePath)
	const workspaceRoot = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath
	const key = workspaceRoot ? `${workspaceRoot}::${dir}` : dir
	const cached = cache.get(key)
	if (cached !== undefined) {
		scopeLogger?.(`project cache hit: ${cached ? 'aero' : 'non-aero'} key=${key}`)
		return cached
	}

	const result = detectNearestRootAeroProject(dir, workspaceRoot)
	cache.set(key, result)
	scopeLogger?.(`project cache set: ${result ? 'aero' : 'non-aero'} key=${key}`)
	return result
}

function detectNearestRootAeroProject(startDir: string, workspaceRoot?: string): boolean {
	let current = startDir
	const fsRoot = path.parse(current).root
	const stopAt = workspaceRoot ? path.resolve(workspaceRoot) : fsRoot

	while (true) {
		if (isRootCandidateDirectory(current)) {
			scopeLogger?.(`nearest root candidate: ${current}`)
			const result = directoryHasStrongAeroSignal(current)
			scopeLogger?.(`nearest root result: ${result ? 'aero' : 'non-aero'} root=${current}`)
			return result
		}
		if (current === stopAt || current === fsRoot) break
		current = path.dirname(current)
	}

	scopeLogger?.(`no project root candidate found from ${startDir} (stopAt=${stopAt})`)
	return false
}

function isRootCandidateDirectory(dir: string): boolean {
	for (const fileName of ROOT_CANDIDATE_FILES) {
		if (fs.existsSync(path.join(dir, fileName))) return true
	}
	return false
}

function directoryHasStrongAeroSignal(dir: string): boolean {
	for (const aeroConfig of AERO_CONFIG_FILES) {
		const p = path.join(dir, aeroConfig)
		if (fileContainsAll(p, AERO_CONFIG_PATTERNS)) {
			scopeLogger?.(`signal match: aero.config (${p})`)
			return true
		}
	}

	for (const viteConfig of VITE_CONFIG_FILES) {
		const p = path.join(dir, viteConfig)
		if (fileContainsAny(p, VITE_CONFIG_PATTERNS)) {
			scopeLogger?.(`signal match: vite.config (${p})`)
			return true
		}
	}

	const packageJsonPath = path.join(dir, 'package.json')
	if (fileContainsAny(packageJsonPath, PACKAGE_PATTERNS)) {
		scopeLogger?.(`signal match: package.json (${packageJsonPath})`)
		return true
	}

	return false
}

function fileContainsAny(filePath: string, patterns: RegExp[]): boolean {
	try {
		if (!fs.existsSync(filePath)) return false
		const content = fs.readFileSync(filePath, 'utf-8')
		return patterns.some(pattern => pattern.test(content))
	} catch {
		return false
	}
}

function fileContainsAll(filePath: string, patterns: RegExp[]): boolean {
	try {
		if (!fs.existsSync(filePath)) return false
		const content = fs.readFileSync(filePath, 'utf-8')
		return patterns.every(pattern => pattern.test(content))
	} catch {
		return false
	}
}
