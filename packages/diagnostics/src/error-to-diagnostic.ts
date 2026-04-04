/**
 * Shared Error → AeroDiagnostic mapping used by both the Effect Cause pipeline
 * and the catch-block `unknownToAeroDiagnostics` path.
 *
 * Consolidates CSS augmentation and stack-span extraction so they
 * don't drift between the two entry points.
 */

import { augmentFromCssSyntaxError } from './css-postcss-error'
import { firstStackSpan } from './stack-frame'
import { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'
import type { AeroDiagnostic, AeroDiagnosticCode, AeroDiagnosticSpan } from './types'

/** Map an `AeroCompileError` to a diagnostic. */
export function compileErrorToDiagnostic(value: AeroCompileError): AeroDiagnostic {
	const span: AeroDiagnosticSpan | undefined =
		value.file !== undefined && value.line !== undefined
			? { file: value.file, line: value.line, column: value.column ?? 0 }
			: undefined

	return {
		code: 'AERO_COMPILE',
		severity: 'error',
		message: value.message,
		file: value.file,
		span,
	}
}

/** Map an `AeroBuildCancelledError` to a diagnostic. */
export function cancelledErrorToDiagnostic(value: AeroBuildCancelledError): AeroDiagnostic {
	return {
		code: 'AERO_INTERNAL',
		severity: 'warning',
		message: value.message || 'Static build cancelled',
	}
}

/**
 * Map a generic `Error` (with possible CSS augmentation and stack span) to a diagnostic.
 * This is the shared core that both `failureToAeroDiagnostics` and `unknownToAeroDiagnostics` use.
 */
export function genericErrorToDiagnostic(
	err: Error,
	code: AeroDiagnosticCode = 'AERO_COMPILE'
): AeroDiagnostic {
	const css = augmentFromCssSyntaxError(err)
	const stackSpan = css ? undefined : firstStackSpan(err.stack)

	return {
		code,
		severity: 'error',
		message: css?.message ?? (err.message || String(err)),
		file: css?.file ?? stackSpan?.file,
		span:
			css?.span ??
			(stackSpan
				? { file: stackSpan.file, line: stackSpan.line, column: stackSpan.column }
				: undefined),
		...(css?.frame ? { frame: css.frame } : {}),
		...(css?.hint ? { hint: css.hint } : {}),
	}
}

/** Fallback for non-Error values. */
export function unknownValueToDiagnostic(
	value: unknown,
	code: AeroDiagnosticCode = 'AERO_INTERNAL'
): AeroDiagnostic {
	return {
		code,
		severity: 'error',
		message: typeof value === 'string' ? value : `Unknown failure: ${String(value)}`,
	}
}
