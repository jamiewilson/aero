/**
 * Expected failures for Aero compiler / Vite pipeline (Effect TaggedError).
 */

import { Data } from 'effect'

/** Recoverable compile-time failure with optional source location. */
export class AeroCompileError extends Data.TaggedError('AeroCompileError')<{
	readonly message: string
	readonly file?: string
	readonly line?: number
	readonly column?: number
}> {}
