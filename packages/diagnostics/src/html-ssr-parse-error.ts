/**
 * Map Rolldown/Vite HTML-module SSR PARSE_ERROR values into {@link AeroDiagnostic} and unified terminal output.
 */

import { formatDiagnosticsTerminal } from './render/terminal'
import { normalizeParseErrorFrame } from './frame-normalize'
import type { AeroDiagnostic } from './types'

const STRIP_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

function stripAnsi(s: string): string {
	return s.replace(STRIP_ANSI, '')
}

/** Hint for SSR parse failures (same guidance as legacy condensed formatter). */
export const HTML_SSR_PARSE_HINT =
	'Check `<style>` / `props="{...}"` and `{ }` blocks in that template.'

function parseErrorSummary(message: string): string {
	const noAnsi = stripAnsi(message)
	const withoutAtFile = noAnsi.replace(/\nAt file:.*$/s, '').trim()
	const lines = withoutAtFile
		.split('\n')
		.map(l => l.trim())
		.filter(Boolean)
	const unexpected = lines.find(
		l => l.startsWith('Unexpected ') || l.startsWith('Expected ') || /^[\w\s]+ error:/i.test(l)
	)
	if (unexpected && !unexpected.startsWith('Parse failure:')) return unexpected
	const m = withoutAtFile.match(/Parse failed with \d+ error[s]?:\s*\n\s*([^\n]+)/)
	if (m?.[1]) return m[1]!.trim()
	const pf = lines.find(l => l.startsWith('Parse failure:'))
	if (pf) {
		const rest = pf.slice('Parse failure:'.length).trim()
		const firstLine = rest.split('\n')[0]?.trim()
		if (firstLine) return firstLine
	}
	return 'Invalid JavaScript in compiled output'
}

function isHtmlModuleId(id: string | undefined): boolean {
	if (!id) return false
	return id.includes('.html') && !id.includes('node_modules')
}

/** Vite/Rolldown error shape for HTML-derived module parse failures. */
export type HtmlModuleSsrParseError = Error & {
	code?: string
	id?: string
	loc?: { file?: string; line?: number; column?: number }
	frame?: string
}

/** @deprecated Use {@link HtmlModuleSsrParseError}. */
export type WithParseMeta = HtmlModuleSsrParseError

/**
 * Whether {@link formatCondensedHtmlSsrParseError} should replace the default Vite message.
 */
export function isCondensableHtmlSsrParseError(err: unknown): err is HtmlModuleSsrParseError {
	if (!(err instanceof Error)) return false
	const e = err as HtmlModuleSsrParseError
	if (e.code !== 'PARSE_ERROR') return false
	const file = e.loc?.file ?? e.id
	return isHtmlModuleId(file)
}

/**
 * Build an {@link AeroDiagnostic} for an HTML SSR parse failure (unified with compile diagnostics).
 */
export function htmlSsrParseErrorToAeroDiagnostic(err: HtmlModuleSsrParseError): AeroDiagnostic {
	const filePath = err.loc?.file ?? err.id
	const line = err.loc?.line
	const col = err.loc?.column
	const summary = parseErrorSummary(err.message || String(err))
	const frameRaw = err.frame ? stripAnsi(err.frame) : ''
	const frame = frameRaw ? normalizeParseErrorFrame(frameRaw, line).trimEnd() : undefined

	const file = filePath ?? undefined
	const span =
		file && line !== undefined && col !== undefined ? { file, line, column: col } : undefined

	return {
		code: 'AERO_COMPILE',
		severity: 'error',
		message: `SSR parse (invalid JS from .html): ${summary}`,
		file,
		span,
		frame,
		hint: HTML_SSR_PARSE_HINT,
	}
}

/**
 * Format an HTML-module SSR parse error using the same terminal layout as other Aero diagnostics.
 */
export function formatCondensedHtmlSsrParseError(err: HtmlModuleSsrParseError): string {
	return formatDiagnosticsTerminal([htmlSsrParseErrorToAeroDiagnostic(err)])
}
