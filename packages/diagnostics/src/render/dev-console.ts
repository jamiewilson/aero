/**
 * Vite-like colored console layout for Aero diagnostics (dev terminal).
 *
 * @example
 * ```
 * 2:36:27 PM [aero] Error: Missing opening { client/assets/styles/global.css:21:1
 *
 *   19 |   --box-padding: 1.5rem;
 * > 21 | }
 * ```
 */

import { diagnosticFileLocationLine } from '../diagnostic-display'
import { diagnosticPathForDisplay } from '../path-display'
import type { AeroDiagnostic } from '../types'

export interface FormatDiagnosticsDevConsoleOptions {
	/** When false, omit ANSI colors. Default: color when stdout is a TTY and `NO_COLOR` is unset. */
	colors?: boolean
	/** Override timestamp (tests). Default: current local time. */
	now?: Date
}

const ANSI = {
	reset: '\x1b[0m',
	gray: '\x1b[90m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
} as const

function wantColors(explicit?: boolean): boolean {
	if (explicit !== undefined) return explicit
	if (typeof process === 'undefined') return false
	if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false
	if (process.env.FORCE_COLOR === '0') return false
	return Boolean(process.stdout?.isTTY)
}

function paint(enabled: boolean, color: string, text: string): string {
	if (!enabled || text.length === 0) return text
	return `${color}${text}${ANSI.reset}`
}

function formatTimestamp(date: Date): string {
	let hours = date.getHours()
	const minutes = String(date.getMinutes()).padStart(2, '0')
	const seconds = String(date.getSeconds()).padStart(2, '0')
	const ampm = hours >= 12 ? 'PM' : 'AM'
	hours = hours % 12 || 12
	return `${hours}:${minutes}:${seconds} ${ampm}`
}

function formatLoc(d: AeroDiagnostic, colors: boolean): string | undefined {
	const loc = diagnosticFileLocationLine(d, diagnosticPathForDisplay)
	if (!loc) return undefined
	return paint(colors, ANSI.gray, loc)
}

function formatOne(
	d: AeroDiagnostic,
	colors: boolean,
	now: Date
): string {
	const ts = paint(colors, ANSI.gray, formatTimestamp(now))
	const severityLabel = d.severity === 'warning' ? 'Warning' : 'Error'
	const head = paint(colors, ANSI.red, `[aero] ${severityLabel}: ${d.message}`)
	const loc = formatLoc(d, colors)
	const locSuffix = loc ? ` ${loc}` : ''
	const lines = [`${ts} ${head}${locSuffix}`]

	if (d.frame && d.frame.length > 0) {
		lines.push('')
		lines.push(paint(colors, ANSI.yellow, d.frame))
		lines.push('')
	}

	return lines.join('\n')
}

/**
 * Format diagnostics for the Vite/dev terminal: timestamp + `[aero] Error:` + loc + frame.
 * Omits banners and Hint lines.
 */
export function formatDiagnosticsDevConsole(
	diagnostics: readonly AeroDiagnostic[],
	options: FormatDiagnosticsDevConsoleOptions = {}
): string {
	if (diagnostics.length === 0) return ''
	const colors = wantColors(options.colors)
	const now = options.now ?? new Date()
	return diagnostics.map(d => formatOne(d, colors, now)).join('\n\n')
}
