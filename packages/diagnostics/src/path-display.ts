/**
 * Human-facing file paths: collapse noisy slashes and hide repo-root prefixes in logs/overlays.
 */

import path from 'node:path'

/** Collapse duplicate slashes except after a drive letter (`C:`). */
export function collapsePathSlashes(p: string): string {
	return p.replace(/([^:])\/{2,}/g, '$1/')
}

/**
 * Prefer a path relative to the project root for terminal, SSR error HTML, and browser payloads.
 * Non-absolute paths are returned normalized with forward slashes only.
 *
 * @param absPath - File from diagnostics (often absolute in Node).
 * @param root - Project root (default: `process.cwd()` when available).
 */
export function diagnosticPathForDisplay(absPath: string, root?: string): string {
	if (!absPath) return absPath
	const normalized = path.normalize(collapsePathSlashes(absPath))
	if (!path.isAbsolute(normalized)) {
		return normalized.split(path.sep).join('/')
	}
	const cwd =
		root ??
		(typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '')
	if (!cwd) return normalized.split(path.sep).join('/')
	let rel: string
	try {
		rel = path.relative(cwd, normalized)
	} catch {
		return normalized.split(path.sep).join('/')
	}
	if (rel.startsWith('..') || path.isAbsolute(rel)) return normalized.split(path.sep).join('/')
	if (rel === '') return '.'
	return rel.split(path.sep).join('/')
}
