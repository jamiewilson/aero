/**
 * Serialize AeroDiagnostic[] for dev SSR error responses (header + HTML) and parse in the browser.
 * No Effect; safe for client bundles that only import decode helpers.
 */

import type { AeroDiagnostic } from './types'
import { formatDiagnosticsBrowserHtml } from './format-browser'
import { diagnosticPathForDisplay } from './path-display'

/** Lowercase — use with `Headers.get()`. */
export const AERO_DIAGNOSTICS_HTTP_HEADER = 'x-aero-diagnostics'

/** `document.querySelector` target for JSON payload embedded in error HTML. */
export const AERO_DIAGNOSTICS_SCRIPT_ID = '__AERO_DIAGNOSTICS__'

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null
}

/** Loose validation after JSON.parse (e.g. from network). */
export function parseDiagnosticsJson(value: unknown): AeroDiagnostic[] | null {
	if (!Array.isArray(value)) return null
	const out: AeroDiagnostic[] = []
	for (const item of value) {
		if (!isRecord(item)) return null
		const { code, severity, message, file, span, hint, docsUrl, frame } = item
		if (typeof code !== 'string' || typeof severity !== 'string' || typeof message !== 'string') {
			return null
		}
		if (severity !== 'error' && severity !== 'warning' && severity !== 'info') return null
		const d: AeroDiagnostic = { code, severity, message } as AeroDiagnostic
		if (typeof file === 'string') (d as AeroDiagnostic & { file?: string }).file = file
		if (typeof hint === 'string') (d as AeroDiagnostic & { hint?: string }).hint = hint
		if (typeof docsUrl === 'string') (d as AeroDiagnostic & { docsUrl?: string }).docsUrl = docsUrl
		if (typeof frame === 'string') (d as AeroDiagnostic & { frame?: string }).frame = frame
		if (span !== undefined) {
			if (!isRecord(span)) return null
			const line = span.line
			const column = span.column
			const sfile = span.file
			if (
				typeof line !== 'number' ||
				typeof column !== 'number' ||
				typeof sfile !== 'string'
			) {
				return null
			}
			;(d as AeroDiagnostic & { span?: typeof d.span }).span = {
				file: sfile,
				line,
				column,
			}
		}
		out.push(d)
	}
	return out
}

function diagnosticsForWire(diagnostics: readonly AeroDiagnostic[]): AeroDiagnostic[] {
	const root =
		typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : ''
	return diagnostics.map(d => ({
		...d,
		...(d.file ? { file: diagnosticPathForDisplay(d.file, root) } : {}),
		...(d.span
			? {
					span: {
						...d.span,
						file: diagnosticPathForDisplay(d.span.file, root),
					},
				}
			: {}),
	}))
}

/** Node: base64 UTF-8 payload for `X-Aero-Diagnostics` (paths relative to cwd when under project). */
export function encodeDiagnosticsHeaderValue(diagnostics: readonly AeroDiagnostic[]): string {
	return Buffer.from(JSON.stringify(diagnosticsForWire(diagnostics)), 'utf-8').toString('base64')
}

/** Browser (and Node): decode header or embedded JSON. */
export function decodeDiagnosticsHeaderValue(encoded: string): AeroDiagnostic[] | null {
	try {
		const json = decodeBase64Utf8(encoded.trim())
		const parsed: unknown = JSON.parse(json)
		return parseDiagnosticsJson(parsed)
	} catch {
		return null
	}
}

function decodeBase64Utf8(b64: string): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(b64, 'base64').toString('utf-8')
	}
	const binary = atob(b64)
	const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
	return new TextDecoder('utf-8').decode(bytes)
}

/**
 * Minimal dev error document: visible panel + base64 UTF-8 payload in a plain script tag (id {@link AERO_DIAGNOSTICS_SCRIPT_ID}).
 * Base64 avoids `</script>` and `<` issues from arbitrary diagnostic text.
 */
export function buildDevSsrErrorHtml(diagnostics: readonly AeroDiagnostic[]): string {
	const wire = diagnosticsForWire(diagnostics)
	const b64 = Buffer.from(JSON.stringify(wire), 'utf-8').toString('base64')
	const panel = formatDiagnosticsBrowserHtml(wire)
	return (
		'<!DOCTYPE html>\n' +
		'<html lang="en">\n' +
		'<head>\n' +
		'<meta charset="utf-8"/>\n' +
		'<title>Aero render error</title>\n' +
		'<style>' +
		'body{font-family:system-ui,sans-serif;margin:1.5rem;line-height:1.5;color:#111;}' +
		'h1{font-size:1.25rem;margin-bottom:1rem;}' +
		'.aero-diagnostics ul{list-style:none;padding:0;margin:0;}' +
		'.aero-diag-item{border:1px solid #ccc;border-radius:6px;padding:.75rem 1rem;margin-bottom:.75rem;background:#fafafa;}' +
		'.aero-diag-msg{white-space:pre-wrap;margin:.5rem 0 0;font-size:.9rem;}' +
		'.aero-diag-frame{white-space:pre;font-family:ui-monospace,Menlo,monospace;font-size:.8rem;margin:.5rem 0 0;padding:.5rem;background:#f0f0f0;border-radius:4px;overflow:auto;}' +
		'</style>\n' +
		'</head>\n' +
		'<body>\n' +
		'<h1>Render error (development)</h1>\n' +
		panel +
		`\n<script type="text/plain" id="${AERO_DIAGNOSTICS_SCRIPT_ID}">${b64}</script>\n` +
		'</body>\n' +
		'</html>\n'
	)
}

/**
 * Parse diagnostics from full HTML (e.g. fetch body when header missing).
 */
export function extractDiagnosticsFromDevErrorHtml(html: string): AeroDiagnostic[] | null {
	const re = new RegExp(
		`<script\\s+type=["']text/plain["']\\s+id=["']${AERO_DIAGNOSTICS_SCRIPT_ID}["'][^>]*>([\\s\\S]*?)</script>`,
		'i',
	)
	const m = re.exec(html)
	if (!m?.[1]) return null
	return decodeDiagnosticsHeaderValue(m[1]!.trim())
}
