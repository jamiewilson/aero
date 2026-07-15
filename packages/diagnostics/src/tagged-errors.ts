/**
 * Expected failures for Aero compiler / Vite pipeline.
 */

/** Recoverable compile-time failure with optional source location. */
export class AeroCompileError extends Error {
	readonly _tag = 'AeroCompileError' as const
	readonly file?: string
	readonly line?: number
	readonly column?: number
	readonly code?: 'AERO_COMPILE' | 'AERO_CONFIG'

	constructor(fields: {
		readonly message: string
		readonly file?: string
		readonly line?: number
		readonly column?: number
		readonly code?: 'AERO_COMPILE' | 'AERO_CONFIG'
	}) {
		super(fields.message)
		this.name = 'AeroCompileError'
		this.file = fields.file
		this.line = fields.line
		this.column = fields.column
		this.code = fields.code
	}
}

/** Static prerender was cooperatively cancelled (e.g. SIGINT during build). */
export class AeroBuildCancelledError extends Error {
	readonly _tag = 'AeroBuildCancelledError' as const

	constructor(fields?: { readonly message?: string }) {
		super(fields?.message ?? 'Static build cancelled')
		this.name = 'AeroBuildCancelledError'
	}
}
