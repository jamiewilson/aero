/**
 * Config load errors and diagnostic mapping.
 */

import type { AeroDiagnostic } from '@aero-js/core/diagnostics'
import { unknownToAeroDiagnostics } from '@aero-js/core/diagnostics'

export class AeroConfigLoadError extends Error {
	readonly filePath: string
	readonly causeUnknown: unknown

	constructor(message: string, filePath: string, causeUnknown: unknown) {
		super(message)
		this.name = 'AeroConfigLoadError'
		this.filePath = filePath
		this.causeUnknown = causeUnknown
	}
}

/** Map strict config-load errors to canonical diagnostics category/codes. */
export function configLoadErrorToDiagnostics(err: unknown): AeroDiagnostic[] {
	if (err instanceof AeroConfigLoadError) {
		return unknownToAeroDiagnostics(err.causeUnknown, {
			code: 'AERO_CONFIG',
			file: err.filePath,
		}).map(d => ({
			...d,
			file: err.filePath,
			span: d.span ? { ...d.span, file: err.filePath } : d.span,
		}))
	}
	return unknownToAeroDiagnostics(err, { code: 'AERO_CONFIG' })
}
