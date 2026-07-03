/**
 * Shared path utilities for the Aero framework.
 */

import path from 'node:path'

export { toPosix } from '@aero-js/compiler'

/**
 * Normalize a path to be relative to root and POSIX format.
 */
export function toPosixRelative(value: string, root: string): string {
	const relative = path.relative(root, value)
	if (relative === '') return ''
	return relative.split(path.sep).join('/')
}
