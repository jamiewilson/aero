/**
 * Tiny browser/runtime logger — same `[aero] [CODE]` prefix as terminal diagnostics (no Effect).
 *
 * @packageDocumentation
 */

/**
 * Log a prefixed line to `console.warn` or `console.error`.
 *
 * @param level - `warn` or `error`
 * @param code - Stable code (e.g. `AERO_ROUTE`, `AERO_INTERNAL`) for searchability in support logs
 * @param message - Human-readable detail
 */
export function aeroDevLog(level: 'warn' | 'error', code: string, message: string): void {
	const line = `[aero] [${code}] ${message}`
	if (level === 'error') {
		console.error(line)
	} else {
		console.warn(line)
	}
}
