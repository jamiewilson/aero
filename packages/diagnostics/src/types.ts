/**
 * Serializable Aero diagnostics for terminal, Vite overlay, IDE, and browser surfaces.
 * Produced by compiler / plugin / content (later: mapped from Effect Cause).
 */

export type AeroDiagnosticSeverity = 'error' | 'warning' | 'info'

/** Stable string codes — keep in sync with docs and aero-vscode. */
export type AeroDiagnosticCode =
	| 'AERO_COMPILE'
	| 'AERO_PARSE'
	| 'AERO_RESOLVE'
	| 'AERO_ROUTE'
	| 'AERO_TEMPLATE'
	| 'AERO_SWITCH'
	| 'AERO_CONTENT_SCHEMA'
	| 'AERO_CONFIG'
	| 'AERO_BUILD_SCRIPT'
	| 'AERO_INTERNAL'

export interface AeroDiagnosticSpan {
	file: string
	line: number
	column: number
	lineEnd?: number
	columnEnd?: number
}

export interface AeroDiagnostic {
	readonly code: AeroDiagnosticCode
	readonly severity: AeroDiagnosticSeverity
	readonly message: string
	readonly file?: string
	readonly span?: AeroDiagnosticSpan
	/** Rollup-style code snippet for Vite overlay / browser panel (optional; may be filled from disk). */
	readonly frame?: string
	readonly hint?: string
	readonly docsUrl?: string
}
