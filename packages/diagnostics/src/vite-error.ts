/**
 * Map AeroDiagnostic to fields accepted by Vite/Rollup `this.error(...)`.
 */

import { diagnosticPathForDisplay } from './path-display'
import type { AeroDiagnostic } from './types'

/** Rollup-compatible error fields (Vite plugin context). */
export interface AeroViteErrorFields {
	message: string
	id?: string
	plugin?: string
	loc?: { file?: string; line: number; column: number }
	frame?: string
}

/**
 * Convert a single diagnostic to Vite/Rollup `this.error` argument.
 * Caller should pass the primary diagnostic; bundle extras in `message` if needed.
 */
export function aeroDiagnosticToViteErrorFields(
	d: AeroDiagnostic,
	plugin?: string
): AeroViteErrorFields {
	const id = d.span?.file ?? d.file
	const prefix = `[${d.code}] `
	const displayBase = d.file ? diagnosticPathForDisplay(d.file) : ''
	const where =
		d.span && displayBase
			? `${displayBase}:${d.span.line}:${d.span.column}: `
			: displayBase
				? `${displayBase}: `
				: ''
	const message = `${prefix}${where}${d.message}`

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

export function diagnosticsToSingleMessage(
	diagnostics: readonly AeroDiagnostic[],
	opts: { includeCodePrefix?: boolean } = {}
): string {
	const parts = diagnostics.map(d => {
		const prefix = opts.includeCodePrefix !== false ? `[${d.code}] ` : ''
		const base = d.file ? diagnosticPathForDisplay(d.file) : ''
		const where =
			d.span && base ? `${base}:${d.span.line}:${d.span.column}: ` : base ? `${base}: ` : ''
		return `${prefix}${where}${d.message}`
	})
	return parts.join('\n')
}
