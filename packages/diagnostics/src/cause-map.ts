/**
 * Map Effect Cause / Exit failure to AeroDiagnostic[] for terminal, Vite, IDE.
 */

import * as Cause from 'effect/Cause'
import * as Chunk from 'effect/Chunk'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import type { AeroDiagnostic } from './types'
import { augmentFromCssSyntaxError } from './css-postcss-error'
import { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'
import { firstStackSpan } from './stack-frame'

/**
 * Convert an Effect failure value from Cause.fail into diagnostics (single or multiple per parallel Cause).
 */
export function failureToAeroDiagnostics(value: unknown): AeroDiagnostic[] {
	if (value instanceof AeroBuildCancelledError) {
		return [
			{
				code: 'AERO_INTERNAL',
				severity: 'warning',
				message: value.message ?? 'Static build cancelled',
			},
		]
	}

	if (value instanceof AeroCompileError) {
		const span =
			value.file !== undefined && value.line !== undefined
				? {
						file: value.file,
						line: value.line,
						column: value.column ?? 0,
					}
				: undefined

		return [
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: value.message,
				file: value.file,
				span,
			},
		]
	}

	if (value instanceof Error) {
		const css = augmentFromCssSyntaxError(value)
		const stackSpan = css ? undefined : firstStackSpan(value.stack)
		return [
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: css?.message ?? (value.message || String(value)),
				file: css?.file ?? stackSpan?.file,
				span:
					css?.span ??
					(stackSpan
						? {
								file: stackSpan.file,
								line: stackSpan.line,
								column: stackSpan.column,
							}
						: undefined),
				...(css?.frame ? { frame: css.frame } : {}),
				...(css?.hint ? { hint: css.hint } : {}),
			},
		]
	}

	return [
		{
			code: 'AERO_INTERNAL',
			severity: 'error',
			message: typeof value === 'string' ? value : `Unknown failure: ${String(value)}`,
		},
	]
}

/**
 * Flatten Cause failures (including parallel) into Aero diagnostics.
 * Defect-only causes fall back to AERO_INTERNAL with Cause.pretty.
 */
export function mapCauseToAeroDiagnostics<E>(cause: Cause.Cause<E>): AeroDiagnostic[] {
	const fails = Chunk.toArray(Cause.failures(cause)) as readonly unknown[]
	if (fails.length > 0) {
		return fails.flatMap(f => failureToAeroDiagnostics(f))
	}
	return [
		{
			code: 'AERO_INTERNAL',
			severity: 'error',
			message: Cause.pretty(cause),
		},
	]
}

/** Use after `Effect.runSyncExit` / `runPromiseExit` when Exit.isFailure(exit). */
export function exitFailureToAeroDiagnostics<A, E>(exit: Exit.Exit<A, E>): AeroDiagnostic[] {
	return Option.match(Exit.causeOption(exit), {
		onNone: () => [],
		onSome: mapCauseToAeroDiagnostics,
	})
}
