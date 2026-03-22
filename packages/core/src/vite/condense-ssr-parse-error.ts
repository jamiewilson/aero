/**
 * Re-exports HTML SSR parse error helpers from `@aero-js/diagnostics` (unified terminal formatting).
 */

export {
	formatCondensedHtmlSsrParseError,
	htmlSsrParseErrorToAeroDiagnostic,
	isCondensableHtmlSsrParseError,
	normalizeParseErrorFrame,
	HTML_SSR_PARSE_HINT,
	type HtmlModuleSsrParseError,
	type WithParseMeta,
} from '@aero-js/diagnostics'
