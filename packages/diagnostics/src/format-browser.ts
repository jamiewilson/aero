/**
 * Safe HTML snippets for in-browser dev error UI (no Effect; no HTML injection).
 */

import { diagnosticPathForDisplay } from './path-display'
import type { AeroDiagnostic } from './types'

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

/**
 * Single-line diagnostic for a compact panel.
 */
export function formatDiagnosticPlainText(d: AeroDiagnostic): string {
	const fileDisp = d.file ? diagnosticPathForDisplay(d.file) : ''
	const where = fileDisp ? (d.span ? `${fileDisp}:${d.span.line}:${d.span.column}` : fileDisp) : ''
	return where ? `[${d.code}] ${where}\n${d.message}` : `[${d.code}] ${d.message}`
}

/**
 * Minimal HTML fragment for embedding in `innerHTML` during dev (escapes all text).
 */
export function formatDiagnosticsBrowserHtml(diagnostics: readonly AeroDiagnostic[]): string {
	if (diagnostics.length === 0) return ''

	const items = diagnostics
		.map(d => {
			const fileDisp = d.file ? diagnosticPathForDisplay(d.file) : ''
			const meta = [d.code, fileDisp, d.span && `${d.span.line}:${d.span.column}`]
				.filter(Boolean)
				.join(' · ')
			const hint = d.hint ? `<p class="aero-diag-hint">${escapeHtml(d.hint)}</p>` : ''
			const docs = d.docsUrl
				? `<p class="aero-diag-docs"><a href="${escapeHtml(d.docsUrl)}">Documentation</a></p>`
				: ''
			const frame = d.frame ? `<pre class="aero-diag-frame">${escapeHtml(d.frame)}</pre>` : ''
			return `<li class="aero-diag-item"><strong>${escapeHtml(meta)}</strong><pre class="aero-diag-msg">${escapeHtml(d.message)}</pre>${frame}${hint}${docs}</li>`
		})
		.join('')

	return `<div class="aero-diagnostics" data-aero-diagnostics="1"><ul>${items}</ul></div>`
}

/**
 * Escape arbitrary user/exception text for safe insertion (e.g. legacy &lt;pre&gt; fallback).
 */
export function escapeForBrowserPre(text: string): string {
	return escapeHtml(text)
}
