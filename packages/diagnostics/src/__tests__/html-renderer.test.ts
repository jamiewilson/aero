/**
 * HTML renderer: section-based HTML generation with escaping.
 */

import { describe, expect, it } from 'vitest'
import {
	htmlRenderer,
	formatDiagnosticsBrowserHtml,
	formatDiagnosticPlainText,
	escapeForBrowserPre,
} from '../render/html'
import type { AeroDiagnostic } from '../types'

const diag: AeroDiagnostic = {
	code: 'AERO_COMPILE',
	severity: 'error',
	message: 'broken <template>',
	file: 'pages/a.html',
	span: { file: 'pages/a.html', line: 1, column: 0 },
	frame: '> 1 | <div>',
	hint: 'use & carefully',
	docsUrl: 'https://aero.dev/docs',
}

describe('htmlRenderer', () => {
	it('renderOne produces a section element with correct data attribute', () => {
		const html = htmlRenderer.renderOne(diag, 0, 1, { banners: true })
		expect(html).toContain('data-aero-code="AERO_COMPILE"')
		expect(html).toContain('<section class="aero-diag-block"')
	})

	it('renderOne escapes HTML in message', () => {
		const html = htmlRenderer.renderOne(diag, 0, 1)
		expect(html).toContain('broken &lt;template&gt;')
		expect(html).not.toContain('<template>')
	})

	it('renderOne includes banner elements when banners: true', () => {
		const html = htmlRenderer.renderOne(diag, 0, 1, { banners: true })
		expect(html).toContain('class="aero-diag-banner aero-diag-banner--top"')
		expect(html).toContain('class="aero-diag-banner aero-diag-banner--bottom"')
	})

	it('renderOne omits banner elements when banners: false', () => {
		const html = htmlRenderer.renderOne(diag, 0, 1, { banners: false })
		expect(html).not.toContain('aero-diag-banner')
	})

	it('renderOne includes frame, hint, and docs sections', () => {
		const html = htmlRenderer.renderOne(diag, 0, 1, { banners: false })
		expect(html).toContain('aero-diag-frame')
		expect(html).toContain('&gt; 1 | &lt;div&gt;')
		expect(html).toContain('aero-diag-row--hint')
		expect(html).toContain('use &amp; carefully')
		expect(html).toContain('href="https://aero.dev/docs"')
	})

	it('renderDiagnostics wraps in aero-diagnostics container', () => {
		const html = htmlRenderer.renderDiagnostics([diag])
		expect(html).toContain('class="aero-diagnostics"')
		expect(html).toContain('data-aero-diagnostics="1"')
	})

	it('renderDiagnostics returns empty string for empty array', () => {
		expect(htmlRenderer.renderDiagnostics([])).toBe('')
	})

	it('renderDiagnostics shows index when multiple diagnostics', () => {
		const d2: AeroDiagnostic = { ...diag, message: 'also broken' }
		const html = htmlRenderer.renderDiagnostics([diag, d2])
		expect(html).toContain('(1 of 2)')
		expect(html).toContain('(2 of 2)')
	})
})

describe('formatDiagnosticsBrowserHtml (compat wrapper)', () => {
	it('banners: false omits banner elements', () => {
		const html = formatDiagnosticsBrowserHtml([diag], { banners: false })
		expect(html).not.toContain('aero-diag-banner')
	})

	it('banners: true (default) includes banner elements', () => {
		const html = formatDiagnosticsBrowserHtml([diag])
		expect(html).toContain('aero-diag-banner')
	})
})

describe('formatDiagnosticPlainText', () => {
	it('includes code, location, and message', () => {
		const text = formatDiagnosticPlainText(diag)
		expect(text).toContain('[AERO_COMPILE]')
		expect(text).toContain('pages/a.html:1:0')
		expect(text).toContain('broken <template>')
	})

	it('omits location when no file', () => {
		const text = formatDiagnosticPlainText({
			code: 'AERO_INTERNAL',
			severity: 'error',
			message: 'oops',
		})
		expect(text).toBe('[AERO_INTERNAL] oops')
	})
})

describe('escapeForBrowserPre', () => {
	it('escapes angle brackets and ampersands', () => {
		expect(escapeForBrowserPre('<b>&')).toBe('&lt;b&gt;&amp;')
	})
})
