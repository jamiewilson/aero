/**
 * Shared path utilities for the Aero framework.
 */

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
	// Simple relative path computation without Node's path module
	const valuePosix = toPosix(value)
	const rootPosix = toPosix(root)

	// If value is under root, compute relative path
	if (valuePosix.startsWith(rootPosix + '/')) {
		return valuePosix.slice(rootPosix.length + 1)
	}
	// Already relative or unrelated - return as-is
	return valuePosix
}
