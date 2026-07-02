/**
 * Expected failures for Aero compiler / Vite pipeline.
 */

/** Recoverable compile-time failure with optional source location. */
export class AeroCompileError extends Error {
	readonly _tag = 'AeroCompileError' as const
	readonly file?: string
	readonly line?: number
	readonly column?: number

	constructor(fields: {
		readonly message: string
		readonly file?: string
		readonly line?: number
		readonly column?: number
	}) {
		super(fields.message)
		this.name = 'AeroCompileError'
		this.file = fields.file
		this.line = fields.line
		this.column = fields.column
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
