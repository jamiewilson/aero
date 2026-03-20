/**
 * Rollup/Vite-style source snippets for overlays and dev HTML (Node reads disk when possible).
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AeroDiagnostic } from './types'

const DEFAULT_CONTEXT = 2
/** Display width of tab stops for code frames (matches common CSS formatters / editor default). */
const FRAME_TAB_WIDTH = 2

/**
 * Expand U+0009 to spaces for a single line (newline units not expected).
 */
export function expandTabsToSpacesForFrame(line: string, tabWidth = FRAME_TAB_WIDTH): string {
	let out = ''
	let col = 0
	for (let c = 0; c < line.length; c++) {
		const ch = line.charCodeAt(c)
		if (ch === 9) {
			const advance = tabWidth - (col % tabWidth)
			out += ' '.repeat(advance)
			col += advance
		} else {
			out += line.charAt(c)
			col++
		}
	}
	return out
}

/** Visual column in a monospace frame after `index` code units (tabs expanded, 0-based). */
export function visualColumnBeforeIndex(
	line: string,
	index: number,
	tabWidth = FRAME_TAB_WIDTH
): number {
	const i = Math.min(Math.max(0, index), line.length)
	let col = 0
	for (let c = 0; c < i; c++) {
		const ch = line.charCodeAt(c)
		if (ch === 9) col += tabWidth - (col % tabWidth)
		else col++
	}
	return col
}

/**
 * Build a multi-line code frame from full file source (no I/O).
 *
 * @param line1Based - 1-based line index matching {@link AeroDiagnosticSpan.line}.
 * @param column0Based - 0-based column matching Rollup/Vite `loc.column`.
 */
export function formatSourceFrameFromSource(
	source: string,
	line1Based: number,
	column0Based: number,
	context = DEFAULT_CONTEXT
): string {
	if (line1Based < 1) return ''
	const lines = source.split(/\r?\n/)
	const idx = line1Based - 1
	if (idx < 0 || idx >= lines.length) return ''

	const start = Math.max(0, idx - context)
	const end = Math.min(lines.length, idx + context + 1)
	const stopNum = end
	const gutterW = String(stopNum).length
	const out: string[] = []

	for (let i = start; i < end; i++) {
		const n = i + 1
		const isErr = n === line1Based
		const prefix = isErr ? '>' : ' '
		const num = String(n).padStart(gutterW, ' ')
		const rawLine = lines[i] ?? ''
		const lineText = expandTabsToSpacesForFrame(rawLine)
		out.push(`${prefix} ${num} | ${lineText}`)

		if (isErr) {
			const idx = Math.min(Math.max(0, column0Based), rawLine.length)
			const caretCol = visualColumnBeforeIndex(rawLine, idx)
			const gutterPad = `  ${' '.repeat(gutterW)} | `
			out.push(`${gutterPad}${' '.repeat(caretCol)}^`)
		}
	}

	return out.join('\n')
}

function resolveFsPath(filePath: string): string {
	if (path.isAbsolute(filePath)) return filePath
	if (typeof process === 'undefined' || typeof process.cwd !== 'function') return filePath
	return path.resolve(process.cwd(), filePath)
}

/**
 * When the diagnostic already has {@link AeroDiagnostic.frame}, return it.
 * Otherwise try to read {@link AeroDiagnostic.file} / {@link AeroDiagnosticSpan.file} from disk.
 */
export function tryReadSourceFrameForDiagnostic(d: AeroDiagnostic): string | undefined {
	if (d.frame !== undefined && d.frame.length > 0) return d.frame

	const line = d.span?.line
	if (line === undefined || line < 1) return undefined

	const col = d.span?.column ?? 0
	const filePath =
		d.span?.file && d.span.file.length > 0
			? d.span.file
			: d.file && d.file.length > 0
				? d.file
				: undefined
	if (!filePath) return undefined

	const resolved = resolveFsPath(filePath)
	if (!existsSync(resolved)) return undefined

	try {
		const source = readFileSync(resolved, 'utf8')
		return formatSourceFrameFromSource(source, line, col)
	} catch {
		return undefined
	}
}

/**
 * Attach {@link AeroDiagnostic.frame} when missing and the source file is readable.
 */
export function enrichDiagnosticsWithSourceFrames(
	diagnostics: readonly AeroDiagnostic[]
): AeroDiagnostic[] {
	return diagnostics.map(d => {
		const frame = tryReadSourceFrameForDiagnostic(d)
		if (!frame || d.frame === frame) return d
		return { ...d, frame }
	})
}
