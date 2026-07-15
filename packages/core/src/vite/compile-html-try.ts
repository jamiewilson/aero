/**
 * Run synchronous HTML compile (parse → client script sync → codegen); map failures to AeroCompileError.
 */

import { AeroCompileError } from '@aero-js/diagnostics'
import { CompileError } from '@aero-js/compiler'

function toAeroCompileError(unknown: unknown, importer: string): AeroCompileError {
	if (unknown instanceof AeroCompileError) return unknown
	if (unknown instanceof CompileError) {
		return new AeroCompileError({
			message: unknown.message,
			file: unknown.file ?? importer,
			line: unknown.line,
			column: unknown.column,
			...(unknown.code ? { code: unknown.code } : {}),
		})
	}
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
}

/**
 * Run a synchronous compile thunk; thrown values become `AeroCompileError`.
 *
 * @param importer - Absolute path used when a generic `Error` has no file (fallback in catch).
 * @param tryFn - Parse + compile body; must return generated JS source.
 */
export function htmlCompileTry<A>(importer: string, tryFn: () => A): A {
	try {
		return tryFn()
	} catch (unknown) {
		throw toAeroCompileError(unknown, importer)
	}
}
