/**
 * Browser-safe diagnostics surface (no Effect, no `node:fs`). Used by `@aero-js/core` client runtime.
 *
 * @packageDocumentation
 */

export type {
	AeroDiagnostic,
	AeroDiagnosticCode,
	AeroDiagnosticSeverity,
	AeroDiagnosticSpan,
} from './types'
export {
	formatDiagnosticPlainText,
	formatDiagnosticsBrowserHtml,
	escapeForBrowserPre,
} from './format-browser'
export {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	AERO_DIAGNOSTICS_SCRIPT_ID,
	decodeDiagnosticsHeaderValue,
	extractDiagnosticsFromDevErrorHtml,
	parseDiagnosticsJson,
} from './dev-ssr-transport'
