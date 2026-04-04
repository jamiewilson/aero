/**
 * Serialize / deserialize AeroDiagnostic[] for HTTP transport (header + embedded payload).
 * Pure data marshalling — no HTML generation, no Effect, safe for browser bundles.
 */

import { diagnosticPathForDisplay } from './path-display'
import type { AeroDiagnostic, AeroDiagnosticSpan } from './types'

/** Lowercase — use with `Headers.get()`. */
export const AERO_DIAGNOSTICS_HTTP_HEADER = 'x-aero-diagnostics'

/** `document.querySelector` target for JSON payload embedded in error HTML. */
export const AERO_DIAGNOSTICS_SCRIPT_ID = '__AERO_DIAGNOSTICS__'

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null
}

/**
 * Rewrite absolute paths to display-friendly relative paths for wire transport.
 */
export function diagnosticsForWire(diagnostics: readonly AeroDiagnostic[]): AeroDiagnostic[] {
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

/** Loose validation after JSON.parse (e.g. from network). Faithfully round-trips all fields. */
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

		const d: Record<string, unknown> = { code, severity, message }
		if (typeof file === 'string') d.file = file
		if (typeof hint === 'string') d.hint = hint
		if (typeof docsUrl === 'string') d.docsUrl = docsUrl
		if (typeof frame === 'string') d.frame = frame

		if (span !== undefined) {
			if (!isRecord(span)) return null
			const { line, column, file: sfile, lineEnd, columnEnd } = span
			if (typeof line !== 'number' || typeof column !== 'number' || typeof sfile !== 'string') {
				return null
			}
			const spanObj: AeroDiagnosticSpan = { file: sfile, line, column }
			if (typeof lineEnd === 'number') spanObj.lineEnd = lineEnd
			if (typeof columnEnd === 'number') spanObj.columnEnd = columnEnd
			d.span = spanObj
		}
		out.push(d as unknown as AeroDiagnostic)
	}
	return out
}

/** Node: base64 UTF-8 payload for `X-Aero-Diagnostics` (paths relative to cwd when under project). */
export function encodeDiagnosticsHeaderValue(diagnostics: readonly AeroDiagnostic[]): string {
	return Buffer.from(JSON.stringify(diagnosticsForWire(diagnostics)), 'utf-8').toString('base64')
}

function decodeBase64Utf8(b64: string): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(b64, 'base64').toString('utf-8')
	}
	const binary = atob(b64)
	const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
	return new TextDecoder('utf-8').decode(bytes)
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
