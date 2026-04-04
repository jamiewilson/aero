/**
 * Map Effect Cause / Exit failure to AeroDiagnostic[] for terminal, Vite, IDE.
 */

import * as Cause from 'effect/Cause'
import * as Chunk from 'effect/Chunk'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import type { AeroDiagnostic } from './types'
import {
	cancelledErrorToDiagnostic,
	compileErrorToDiagnostic,
	genericErrorToDiagnostic,
	unknownValueToDiagnostic,
} from './error-to-diagnostic'
import { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'

/**
 * Convert an Effect failure value from Cause.fail into diagnostics (single or multiple per parallel Cause).
 */
export function failureToAeroDiagnostics(value: unknown): AeroDiagnostic[] {
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
