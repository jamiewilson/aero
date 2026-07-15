/**
 * Dev SSR error page: build (Node) and parse (browser-safe).
 */

export {
	AERO_OVERLAY_BOOTSTRAP_ATTR,
	buildDevSsrErrorHtml,
	diagnosticToViteOverlayError,
	type BuildDevSsrErrorHtmlOptions,
	type ViteOverlayErrorPayload,
} from './error-page-build'
export { extractDiagnosticsFromDevErrorHtml } from './error-page-parse'
