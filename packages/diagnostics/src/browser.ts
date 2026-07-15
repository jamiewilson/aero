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
	type FormatDiagnosticsBrowserHtmlOptions,
} from './render/html'
export {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	AERO_DIAGNOSTICS_SCRIPT_ID,
	AERO_OVERLAY_BOOTSTRAP_ATTR,
	decodeDiagnosticsHeaderValue,
	parseDiagnosticsJson,
} from './wire-format'
export { extractDiagnosticsFromDevErrorHtml } from './error-page-parse'
export {
	diagnosticToViteOverlayError,
	type ViteOverlayErrorPayload,
} from './vite-overlay-error'
