/**
 * Map thrown failures to AeroDiagnostic[] for terminal, Vite, IDE.
 */

import type { AeroDiagnostic } from './types'
import {
	cancelledErrorToDiagnostic,
	compileErrorToDiagnostic,
	genericErrorToDiagnostic,
	unknownValueToDiagnostic,
} from './error-to-diagnostic'
import { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'

/**
 * Convert a failure value into diagnostics (single or multiple for AggregateError).
 */
export function failureToAeroDiagnostics(value: unknown): AeroDiagnostic[] {
	if (value instanceof AggregateError) {
		return value.errors.flatMap(err => failureToAeroDiagnostics(err))
	}

	if (value instanceof AeroBuildCancelledError) {
		return [cancelledErrorToDiagnostic(value)]
	}

	if (value instanceof AeroCompileError) {
		return [compileErrorToDiagnostic(value)]
	}

	if (value instanceof Error) {
		return [genericErrorToDiagnostic(value)]
	}

	return [unknownValueToDiagnostic(value)]
}

/** Map a thrown value to diagnostics (primary entry for try/catch paths). */
export function thrownToAeroDiagnostics(err: unknown): AeroDiagnostic[] {
	return failureToAeroDiagnostics(err)
}
