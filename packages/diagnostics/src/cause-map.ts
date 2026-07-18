/**
 * Map thrown failures to AeroDiagnostic[] for terminal, Vite, IDE.
 *
 * @remarks
 * Thin aliases over {@link normalizeToDiagnostics}. Prefer the pipeline API
 * (`normalizeToDiagnostics` / `reportAeroFailure`) at new call sites.
 */

import type { AeroDiagnostic } from './types'
import { normalizeToDiagnostics } from './from-unknown'

/**
 * Convert a failure value into diagnostics (single or multiple for AggregateError).
 *
 * @deprecated Use {@link normalizeToDiagnostics}.
 */
export function failureToAeroDiagnostics(value: unknown): AeroDiagnostic[] {
	return normalizeToDiagnostics(value)
}

/**
 * Map a thrown value to diagnostics (primary entry for try/catch paths).
 *
 * @deprecated Use {@link normalizeToDiagnostics}.
 */
export function thrownToAeroDiagnostics(err: unknown): AeroDiagnostic[] {
	return normalizeToDiagnostics(err)
}
