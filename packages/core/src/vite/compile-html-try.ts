/**
 * Run synchronous HTML compile (parse → client script sync → codegen); map failures to AeroCompileError.
 */

import { AeroCompileError } from '@aero-js/diagnostics'
import { CompileError } from '@aero-js/compiler'

/** Duck-type — `instanceof` fails across duplicate package copies. */
function isCompileErrorLike(
	value: unknown
): value is {
	message: string
	file?: string
	line?: number
	column?: number
	code?: 'AERO_COMPILE' | 'AERO_CONFIG'
} {
	if (value instanceof CompileError) return true
	return value instanceof Error && value.name === 'CompileError'
}

function toAeroCompileError(unknown: unknown, importer: string): AeroCompileError {
	if (unknown instanceof AeroCompileError) return unknown
	if (
		unknown instanceof Error &&
		(unknown.name === 'AeroCompileError' ||
			(unknown as { _tag?: string })._tag === 'AeroCompileError')
	) {
		const err = unknown as Error & {
			file?: string
			line?: number
			column?: number
			code?: 'AERO_COMPILE' | 'AERO_CONFIG'
		}
		return new AeroCompileError({
			message: err.message,
			file: err.file ?? importer,
			line: err.line,
			column: err.column,
			...(err.code ? { code: err.code } : {}),
		})
	}
	if (isCompileErrorLike(unknown)) {
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
