/**
 * Map AeroDiagnostic to fields accepted by Vite/Rollup `this.error(...)`.
 */

import { diagnosticPathForDisplay } from './path-display'
import type { AeroDiagnostic } from './types'
import { stripAeroViteMessageDecorations } from './vite-error-fields'

export type { AeroViteErrorFields } from './vite-error-fields'
export {
	AERO_DIAGNOSTICS_ERROR_PROP,
	aeroDiagnosticToViteErrorFields,
	frameForViteOverlay,
	stripAeroViteMessageDecorations,
} from './vite-error-fields'

export function diagnosticsToSingleMessage(
	diagnostics: readonly AeroDiagnostic[],
	opts: { includeCodePrefix?: boolean; includeLocation?: boolean } = {}
): string {
	const includeCode = opts.includeCodePrefix === true
	const includeLocation = opts.includeLocation === true
	const parts = diagnostics.map(d => {
		const { message } = stripAeroViteMessageDecorations(d.message)
		const prefix = includeCode ? `[${d.code}] ` : ''
		const base = d.file ? diagnosticPathForDisplay(d.file) : ''
		const where =
			includeLocation && d.span && base
				? `${base}:${d.span.line}:${d.span.column}: `
				: includeLocation && base
					? `${base}: `
					: ''
		return `${prefix}${where}${message}`
	})
	return parts.join('\n')
}
