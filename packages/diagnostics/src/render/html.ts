/**
 * HTML diagnostic renderer for in-browser dev error UI.
 *
 * Consumes {@link DiagnosticSection} from the shared layout, producing safe
 * HTML with classes from `templates/overlay.css`. No Effect, no `node:fs`.
 */

import type { AeroDiagnostic } from '../types'
import { diagnosticPathForDisplay } from '../path-display'
import type { DiagnosticRenderer, RenderOptions } from './renderer'
import { type DiagnosticSection, layoutDiagnostic } from './layout'

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function sectionToHtml(s: DiagnosticSection): string {
	switch (s.kind) {
		case 'banner-top':
			return `<pre class="aero-diag-banner aero-diag-banner--top" role="presentation">${escapeHtml(s.value)}</pre>\n`
		case 'banner-bottom':
			return `<pre class="aero-diag-banner aero-diag-banner--bottom" role="presentation">${escapeHtml(s.value)}</pre>`
		case 'index':
			return `<p class="aero-diag-index">${escapeHtml(s.value)}</p>\n`
		case 'file':
			return `<div class="aero-diag-row"><span class="aero-diag-k">${escapeHtml(s.label!)}:</span> <span class="aero-diag-v">${escapeHtml(s.value)}</span></div>\n`
		case 'error':
			return `<div class="aero-diag-row"><span class="aero-diag-k">${escapeHtml(s.label!)}:</span> <span class="aero-diag-v">${escapeHtml(s.value)}</span></div>\n`
		case 'frame':
			return `<pre class="aero-diag-frame">${escapeHtml(s.value)}</pre>\n`
		case 'hint':
			return `<div class="aero-diag-row aero-diag-row--hint"><span class="aero-diag-k">${escapeHtml(s.label!)}:</span> <span class="aero-diag-v">${escapeHtml(s.value)}</span></div>\n`
		case 'docs':
			return `<div class="aero-diag-row"><span class="aero-diag-k">${escapeHtml(s.label!)}:</span> <span class="aero-diag-v"><a href="${escapeHtml(s.value)}">${escapeHtml(s.value)}</a></span></div>\n`
	}
}

function renderOneHtml(
	d: AeroDiagnostic,
	index: number,
	total: number,
	options?: RenderOptions
): string {
	const sections = layoutDiagnostic(d, index, total, {
		banners: options?.banners,
		compact: options?.compact,
	})
	const inner = sections.map(sectionToHtml).join('')
	return (
		`<section class="aero-diag-block" data-aero-code="${escapeHtml(d.code)}">\n` +
		inner +
		`</section>\n`
	)
}

export const htmlRenderer: DiagnosticRenderer<string> = {
	renderOne: renderOneHtml,

	renderDiagnostics(
		diagnostics: readonly AeroDiagnostic[],
		options?: RenderOptions
	): string {
		if (diagnostics.length === 0) return ''
		const blocks = diagnostics.map((d, i) =>
			renderOneHtml(d, i, diagnostics.length, options)
		)
		return `<div class="aero-diagnostics" data-aero-diagnostics="1">\n${blocks.join('')}</div>`
	},
}

export interface FormatDiagnosticsBrowserHtmlOptions {
	/**
	 * When false, omit equals banners (same as terminal `pretty: false`).
	 * Default true.
	 */
	banners?: boolean
}

/**
 * HTML fragment for embedding in `innerHTML` during dev (escapes all text).
 *
 * Drop-in replacement for the previous `formatDiagnosticsBrowserHtml`.
 */
export function formatDiagnosticsBrowserHtml(
	diagnostics: readonly AeroDiagnostic[],
	options: FormatDiagnosticsBrowserHtmlOptions = {}
): string {
	return htmlRenderer.renderDiagnostics(diagnostics, {
		banners: options.banners,
	})
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
 * Escape arbitrary user/exception text for safe insertion (e.g. legacy `<pre>` fallback).
 */
export function escapeForBrowserPre(text: string): string {
	return escapeHtml(text)
}
