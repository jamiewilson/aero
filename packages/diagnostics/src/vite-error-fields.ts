/**
 * Browser-safe Vite/Rollup error field mapping (no Node APIs).
 */

import type { AeroDiagnostic, AeroDiagnosticCode } from './types'

/** Property stamped on Vite plugin errors so the logger keeps framed diagnostics. */
export const AERO_DIAGNOSTICS_ERROR_PROP = '__aeroDiagnostics' as const

/** Rollup-compatible error fields (Vite plugin context / ErrorOverlay). */
export interface AeroViteErrorFields {
	message: string
	id?: string
	plugin?: string
	loc?: { file?: string; line: number; column: number }
	frame?: string
	[AERO_DIAGNOSTICS_ERROR_PROP]?: readonly AeroDiagnostic[]
}

/**
 * Preserve the first line's gutter indentation when Vite ErrorOverlay calls `frame.trim()`.
 * U+200B has zero display width but prevents trim from consuming following spaces.
 */
export function frameForViteOverlay(frame: string | undefined): string | undefined {
	return frame ? `\u200b${frame}` : undefined
}

const AERO_CODE_PREFIX_RE = /^\[(AERO_[A-Z_]+)\]\s*/
const LOCATION_PREFIX_RE = /^(?:[^\n]+?\.(?:html|aero|ts|js|mjs|cjs|tsx|jsx))(?::\d+:\d+)?:\s*/

/**
 * Strip `[AERO_*]` and optional `file:line:col:` prefixes that Vite/Aero embed in messages.
 * Overlay/file fields already show location — keep `message` as the human text only.
 */
export function stripAeroViteMessageDecorations(message: string): {
	code?: AeroDiagnosticCode
	message: string
} {
	let rest = message.trim()
	const codeMatch = AERO_CODE_PREFIX_RE.exec(rest)
	let code: AeroDiagnosticCode | undefined
	if (codeMatch) {
		code = codeMatch[1] as AeroDiagnosticCode
		rest = rest.slice(codeMatch[0].length)
	}
	const locMatch = LOCATION_PREFIX_RE.exec(rest)
	if (locMatch) {
		rest = rest.slice(locMatch[0].length)
	}
	return { code, message: rest.trim() || message.trim() }
}

/**
 * Convert a single diagnostic to Vite/Rollup `this.error` / ErrorOverlay fields.
 *
 * @remarks
 * `message` is the human diagnostic text only. Vite's overlay already shows plugin,
 * file, and location from `plugin` / `id` / `loc` / `frame`.
 */
export function aeroDiagnosticToViteErrorFields(
	d: AeroDiagnostic,
	plugin?: string
): AeroViteErrorFields {
	const id = d.span?.file ?? d.file
	const { message } = stripAeroViteMessageDecorations(d.message)

	const spanFile = d.span?.file && d.span.file.length > 0 ? d.span.file : undefined
	const loc =
		d.span && d.span.line > 0
			? {
					file: spanFile ?? d.file,
					line: d.span.line,
					column: Math.max(0, d.span.column),
				}
			: undefined

	return {
		message,
		id,
		loc,
		plugin: plugin ?? 'vite-plugin-aero',
		...(d.frame ? { frame: d.frame } : {}),
	}
}
