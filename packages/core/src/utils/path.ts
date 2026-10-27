/**
 * Browser-safe path string utilities (no Node built-ins).
 */

/**
 * Convert a path to POSIX format (forward slashes).
 * Handles Windows backslashes and ensures consistent path format across platforms.
 */
export function toPosix(value: string): string {
	return value.replace(/\\/g, '/')
}
