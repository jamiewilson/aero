/**
 * Map a byte/code-unit offset in a source string to 1-based line and 0-based column
 * (Rollup / Vite `loc` convention).
 */

/** @param offset - Start index of the span (0-based); clamped to `[0, source.length]`. */
export function lineColumnAtOffset(source: string, offset: number): { line: number; column: number } {
	const o = Math.max(0, Math.min(offset, source.length))
	let line = 1
	let lineStart = 0
	for (let i = 0; i < o; i++) {
		if (source.charCodeAt(i) === 10) {
			line++
			lineStart = i + 1
		}
	}
	return { line, column: o - lineStart }
}
