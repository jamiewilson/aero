/**
 * Aero project detection and provider gating.
 *
 * @remarks
 * Providers and diagnostics run only for `.html` / `.htm` files inside a detected Aero
 * project. Detection uses the nearest project root candidate and strong signals
 * (`aero.config.*`, `vite.config.*`, `package.json` with `@aero-js/*`).
 */
import * as vscode from 'vscode'
import * as path from 'node:path'
import { isAeroProjectPath } from '@aero-js/core/template-diagnostics'

type ScopeLogFn = (message: string) => void

const cache = new Map<string, boolean>()
let scopeLogger: ScopeLogFn | undefined

export function setScopeDebugLogger(logger: ScopeLogFn | undefined): void {
	scopeLogger = logger
}

/** True for file:// documents whose path ends in .html / .htm. */
export function isHtmlTemplatePath(document: vscode.TextDocument): boolean {
	if (document.uri.scheme !== 'file') return false
	const p = document.uri.fsPath.toLowerCase()
	return p.endsWith('.html') || p.endsWith('.htm')
}

/** Clear project-detection cache (e.g. on config change). */
export function clearScopeCache(): void {
	cache.clear()
}

/** Provider/diagnostics gate: live HTML in a detected Aero project only. */
export function isAeroDocument(document: vscode.TextDocument): boolean {
	return (
		document.uri.scheme === 'file' &&
		document.languageId === 'html' &&
		isHtmlTemplatePath(document) &&
		isInAeroProject(document.uri.fsPath)
	)
}

/** True if a file path is inside a detected Aero project (nearest-root semantics). */
export function isInAeroProjectPath(filePath: string): boolean {
	return isInAeroProject(filePath)
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

	const result = isAeroProjectPath(filePath, workspaceRoot)
	cache.set(key, result)
	scopeLogger?.(`project cache set: ${result ? 'aero' : 'non-aero'} key=${key}`)
	return result
}
