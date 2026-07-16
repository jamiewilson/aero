/**
 * Browser-safe Vite ErrorOverlay payload from Aero diagnostics.
 */

import {
	aeroDiagnosticToViteErrorFields,
	frameForViteOverlay,
} from './vite-error-fields'
import type { AeroDiagnostic } from './types'

/** Payload shape accepted by Vite's `ErrorOverlay`. */
export interface ViteOverlayErrorPayload {
	message: string
	stack?: string
	id?: string
	frame?: string
	plugin?: string
	loc?: { file?: string; line: number; column: number }
}

export function diagnosticToViteOverlayError(
	d: AeroDiagnostic,
	plugin?: string
): ViteOverlayErrorPayload {
	const fields = aeroDiagnosticToViteErrorFields(d, plugin)
	return {
		message: fields.message,
		id: fields.id,
		frame: frameForViteOverlay(fields.frame),
		plugin: fields.plugin,
		loc: fields.loc,
		stack: '',
	}
}
