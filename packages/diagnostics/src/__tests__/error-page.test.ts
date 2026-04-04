/**
 * Error page: build and extract round-trip.
 */

import { describe, expect, it } from 'vitest'
import { buildDevSsrErrorHtml, extractDiagnosticsFromDevErrorHtml } from '../error-page'
import type { AeroDiagnostic } from '../types'

const sample: AeroDiagnostic[] = [
	{
		code: 'AERO_COMPILE',
		severity: 'error',
		message: 'bad <script> edge',
		file: '/proj/pages/a.html',
		span: { file: '/proj/pages/a.html', line: 2, column: 0 },
		frame: '> 2 | x\n  | ^',
	},
]

describe('buildDevSsrErrorHtml', () => {
	it('produces a valid HTML document with title and panel', () => {
		const html = buildDevSsrErrorHtml(sample)
		expect(html).toContain('<!doctype html>')
		expect(html).toContain('<title>Aero Compiler Error</title>')
		expect(html).toContain('<h1>Aero Compiler Error</h1>')
		expect(html).toContain('bad &lt;script&gt; edge')
	})

	it('embeds base64 payload in script tag', () => {
		const html = buildDevSsrErrorHtml(sample)
		expect(html).toContain('id="__AERO_DIAGNOSTICS__"')
		expect(html).toContain('type="text/plain"')
	})

	it('includes overlay styles with CSS custom properties', () => {
		const html = buildDevSsrErrorHtml(sample)
		expect(html).toContain('--aero-diag-bg')
		expect(html).toContain('--aero-diag-text')
		expect(html).toContain('prefers-color-scheme')
	})

	it('does not include banner HTML elements (banners: false)', () => {
		const html = buildDevSsrErrorHtml(sample)
		expect(html).not.toContain('class="aero-diag-banner')
	})
})

describe('extractDiagnosticsFromDevErrorHtml', () => {
	it('extracts diagnostics from buildDevSsrErrorHtml output', () => {
		const html = buildDevSsrErrorHtml(sample)
		const parsed = extractDiagnosticsFromDevErrorHtml(html)
		expect(parsed).toEqual(sample)
	})

	it('returns null for HTML without payload', () => {
		expect(extractDiagnosticsFromDevErrorHtml('<html></html>')).toBeNull()
	})
})
