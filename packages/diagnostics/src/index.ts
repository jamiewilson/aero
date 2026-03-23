/**
 * Aero diagnostic contract: types, formatters, and Vite error mapping.
 * @packageDocumentation
 */

export type {
	AeroDiagnostic,
	AeroDiagnosticCode,
	AeroDiagnosticSeverity,
	AeroDiagnosticSpan,
} from './types'
export { aeroIdeDocHref, aeroIdeDocsUrlForCode } from './ide-catalog'
export { unknownToAeroDiagnostics } from './from-unknown'
export { formatDiagnosticsTerminal, type FormatDiagnosticsTerminalOptions } from './format-terminal'
export { normalizeParseErrorFrame } from './frame-normalize'
export {
	formatCondensedHtmlSsrParseError,
	htmlSsrParseErrorToAeroDiagnostic,
	isCondensableHtmlSsrParseError,
	HTML_SSR_PARSE_HINT,
	type HtmlModuleSsrParseError,
	type WithParseMeta,
} from './html-ssr-parse-error'
export {
	formatDiagnosticPlainText,
	formatDiagnosticsBrowserHtml,
	escapeForBrowserPre,
} from './format-browser'
export {
	aeroDiagnosticToViteErrorFields,
	diagnosticsToSingleMessage,
	type AeroViteErrorFields,
} from './vite-error'
export {
	enrichDiagnosticsWithSourceFrames,
	formatSourceFrameFromSource,
	tryReadSourceFrameForDiagnostic,
} from './source-frame'
export { collapsePathSlashes, diagnosticPathForDisplay } from './path-display'
export { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'
export {
	exitFailureToAeroDiagnostics,
	failureToAeroDiagnostics,
	mapCauseToAeroDiagnostics,
} from './cause-map'
export {
	contentSchemaIssuePayloadsToDiagnostics,
	isContentSchemaAggregateError,
	type ContentSchemaIssuePayload,
} from './content-schema-aggregate'
export {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	AERO_DIAGNOSTICS_SCRIPT_ID,
	buildDevSsrErrorHtml,
	decodeDiagnosticsHeaderValue,
	encodeDiagnosticsHeaderValue,
	extractDiagnosticsFromDevErrorHtml,
	parseDiagnosticsJson,
} from './dev-ssr-transport'
export {
	AERO_EXIT_BUILD_CANCELLED,
	AERO_EXIT_BUILD_GENERIC,
	AERO_EXIT_COMPILE,
	AERO_EXIT_CONFIG,
	AERO_EXIT_CONTENT,
	AERO_EXIT_NITRO,
	AERO_EXIT_ROUTE,
	exitCodeForDiagnostics,
	exitCodeForThrown,
} from './exit-codes'
