/**
 * Wrap synchronous HTML compile (parse → client script sync → codegen) in Effect.try
 * so failures become typed AeroCompileError and map cleanly through Cause / Exit.
 */

import { Effect } from 'effect'
import { AeroCompileError } from '@aero-js/diagnostics'

/**
 * Run a synchronous compile thunk; thrown values become `AeroCompileError` on the failure channel.
 *
 * @param importer - Absolute path used when a generic `Error` has no file (fallback in catch).
 * @param tryFn - Parse + compile body; must return generated JS source.
 */
export function htmlCompileTry<A>(
	importer: string,
	tryFn: () => A,
): Effect.Effect<A, AeroCompileError, never> {
	return Effect.try({
		try: tryFn,
		catch: unknown => {
			if (unknown instanceof AeroCompileError) return unknown
			if (unknown instanceof Error) {
				return new AeroCompileError({
					message: unknown.message || String(unknown),
					file: importer,
				})
			}
			return new AeroCompileError({
				message: String(unknown),
				file: importer,
			})
		},
	})
}
