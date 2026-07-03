/**
 * Shared path utilities for the Aero framework.
 */

import path from 'node:path'

/**
 * Convert a path to POSIX format (forward slashes).
 * Handles Windows backslashes and ensures consistent path format across platforms.
 */
export function toPosix(value: string): string {
	return value.replace(/\\/g, '/')
}

/**
 * Normalize a path to be relative to root and POSIX format.
 */
export function toPosixRelative(value: string, root: string): string {
	const relative = path.relative(root, value)
	if (relative === '') return ''
	return relative.split(path.sep).join('/')
}
