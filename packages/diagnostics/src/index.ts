/**
 * Aero diagnostic contract: types, renderers, wire format, and Vite error mapping.
 * @packageDocumentation
 */

export type {
	AeroDiagnostic,
	AeroDiagnosticCode,
	AeroDiagnosticSeverity,
	AeroDiagnosticSpan,
} from './types'

// --- Renderer architecture ---
export type { DiagnosticRenderer, RenderOptions } from './render/renderer'
export {
	layoutDiagnostic,
	layoutDiagnosticCompact,
	type DiagnosticSection,
	type DiagnosticSectionKind,
	type LayoutOptions,
} from './render/layout'
export { terminalRenderer, formatDiagnosticsTerminal, type FormatDiagnosticsTerminalOptions } from './render/terminal'
export {
	htmlRenderer,
	formatDiagnosticsBrowserHtml,
	formatDiagnosticPlainText,
	escapeForBrowserPre,
	type FormatDiagnosticsBrowserHtmlOptions,
} from './render/html'

// --- Wire format ---
export {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	AERO_DIAGNOSTICS_SCRIPT_ID,
	decodeDiagnosticsHeaderValue,
	encodeDiagnosticsHeaderValue,
	parseDiagnosticsJson,
	diagnosticsForWire,
} from './wire-format'
export { buildDevSsrErrorHtml, extractDiagnosticsFromDevErrorHtml } from './error-page'

// --- Error-to-diagnostic mapping ---
export {
	cancelledErrorToDiagnostic,
	compileErrorToDiagnostic,
	genericErrorToDiagnostic,
	unknownValueToDiagnostic,
} from './error-to-diagnostic'
export { unknownToAeroDiagnostics } from './from-unknown'
export {
	exitFailureToAeroDiagnostics,
	failureToAeroDiagnostics,
	mapCauseToAeroDiagnostics,
} from './cause-map'

// --- Error types ---
export { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'

// --- Source frames and normalization ---
export {
	enrichDiagnosticsWithSourceFrames,
	formatSourceFrameFromSource,
	tryReadSourceFrameForDiagnostic,
} from './source-frame'
export { normalizeParseErrorFrame } from './frame-normalize'
export { tryRefineHtmlReferenceErrorSpan } from './refine-html-reference-error-span'

// --- HTML SSR parse errors ---
export {
	formatCondensedHtmlSsrParseError,
	htmlSsrParseErrorToAeroDiagnostic,
	isCondensableHtmlSsrParseError,
	HTML_SSR_PARSE_HINT,
	type HtmlModuleSsrParseError,
	type WithParseMeta,
} from './html-ssr-parse-error'

// --- Vite integration ---
export {
	aeroDiagnosticToViteErrorFields,
	diagnosticsToSingleMessage,
	type AeroViteErrorFields,
} from './vite-error'

// --- Content schema ---
export {
	contentSchemaIssuePayloadsToDiagnostics,
	isContentSchemaAggregateError,
	type ContentSchemaIssuePayload,
} from './content-schema-aggregate'

// --- Paths, IDE, exit codes, observability ---
export { collapsePathSlashes, diagnosticPathForDisplay } from './path-display'
export { aeroIdeDocHref, aeroIdeDocsUrlForCode } from './ide-catalog'
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
export {
	getDiagnosticsMetricsSnapshot,
	recordDiagnosticsMetrics,
	resetDiagnosticsMetrics,
	startDebugSpan,
	type DiagnosticsMetricsSnapshot,
	type DiagnosticsSurface,
	type DebugSpan,
} from './observability'
