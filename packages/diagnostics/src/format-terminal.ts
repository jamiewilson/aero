/**
 * Plain-text diagnostic formatting for terminal and CI (no chalk required).
 */

import { diagnosticPathForDisplay } from './path-display'
import type { AeroDiagnostic } from './types'

export interface FormatDiagnosticsTerminalOptions {
	/** When true, omit decorations (TTY rule lines). */
	plain?: boolean
	/**
	 * When true, wrap output in light Unicode rules when not `plain`.
	 * Default: `true` when `process.stdout.isTTY`, else false (CI-friendly one-liners).
	 */
	pretty?: boolean
}

function wantsPretty(opts: FormatDiagnosticsTerminalOptions): boolean {
	if (opts.plain) return false
	if (opts.pretty === true) return true
	if (opts.pretty === false) return false
	return (
		typeof process !== 'undefined' && process.stdout !== undefined && process.stdout.isTTY === true
	)
}

function formatOne(d: AeroDiagnostic, index: number, total: number): string {
	const prefix = total > 1 ? `${index + 1}/${total} ` : ''
	const fileDisp = d.file ? diagnosticPathForDisplay(d.file) : ''
	const where = fileDisp ? (d.span ? `${fileDisp}:${d.span.line}:${d.span.column}` : fileDisp) : ''
	const loc = where ? ` ${where}` : ''
	const hint = d.hint ? `\n  hint: ${d.hint}` : ''
	const docs = d.docsUrl ? `\n  docs: ${d.docsUrl}` : ''
	const frame =
		d.frame && d.frame.length > 0
			? `\n${d.frame
					.split('\n')
					.map(l => `  ${l}`)
					.join('\n')}`
			: ''
	return `[aero] ${prefix}[${d.code}]${loc}\n  ${d.severity}: ${d.message}${hint}${docs}${frame}`
}

const RULE = '─'

/**
 * Format diagnostics as newline-separated blocks suitable for stderr / logs.
 */
export function formatDiagnosticsTerminal(
	diagnostics: readonly AeroDiagnostic[],
	options: FormatDiagnosticsTerminalOptions = {}
): string {
	if (diagnostics.length === 0) return ''
	const body = diagnostics.map((d, i) => formatOne(d, i, diagnostics.length)).join('\n\n')
	if (!wantsPretty(options)) return body

	const title = ` aero (${diagnostics.length}) `
	const width = Math.max(24, title.length + 4)
	const pad = Math.max(0, width - title.length - 2)
	const left = Math.floor(pad / 2)
	const right = pad - left
	const line =
		RULE.repeat(left) + title + RULE.repeat(right) + '\n' + body + '\n' + RULE.repeat(width)
	return line
}
