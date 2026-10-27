/**
 * Path helpers that require Node's `path` module (build, Vite, manifest generation).
 */

import path from 'node:path'

/**
 * Normalize a path to be relative to root and POSIX format.
 */
export function toPosixRelative(value: string, root: string): string {
	const relative = path.relative(root, value)
	if (relative === '') return ''
	return relative.split(path.sep).join('/')
}

/** Root-relative URL for a file under `root` (e.g. `/client/pages/about.html`). */
export function toRootRelativeImportUrl(root: string, absolutePath: string): string {
	const rel = toPosixRelative(absolutePath, root)
	return '/' + rel.replace(/^\//, '')
}
