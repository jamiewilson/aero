/**
 * Path utilities for the template compiler.
 */

/**
 * Convert a path to POSIX format (forward slashes).
 * Handles Windows backslashes and ensures consistent path format across platforms.
 */
export function toPosix(value: string): string {
	return value.replace(/\\/g, '/')
}
