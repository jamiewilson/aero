/**
 * Error page: build and extract round-trip.
 */

import { describe, expect, it } from 'vitest'
import {
	AERO_OVERLAY_BOOTSTRAP_ATTR,
	buildDevSsrErrorHtml,
	extractDiagnosticsFromDevErrorHtml,
} from '../error-page'
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
	it('produces a minimal Vite overlay bootstrap shell', () => {
		const html = buildDevSsrErrorHtml(sample)
		expect(html).toContain('<!doctype html>')
		expect(html).toContain(AERO_OVERLAY_BOOTSTRAP_ATTR)
		expect(html).toContain('Aero Compile Error: Loading overlay...')
		expect(html).toContain("import('/@vite/client')")
		expect(html).toContain('ErrorOverlay')
		expect(html).toContain('bad \\u003cscript> edge')
		expect(html).not.toContain('[AERO_COMPILE] /proj/pages/a.html')
		expect(html).toContain('vite:afterUpdate')
		expect(html).toContain('pageIsHealthy')
		expect(html).toContain('reloadWhenFixed')
		expect(html).not.toContain('vite:beforeFullReload')
		expect(html).not.toContain('class="aero-diagnostics"')
	})

	it('embeds base64 payload in script tag', () => {
		const html = buildDevSsrErrorHtml(sample)
		expect(html).toContain('id="__AERO_DIAGNOSTICS__"')
		expect(html).toContain('type="text/plain"')
	})

	it('embeds recover module id when provided', () => {
		const html = buildDevSsrErrorHtml(sample, {
			recoverModuleId: '/client/pages/demos/hypermedia.html',
		})
		expect(html).toContain('/client/pages/demos/hypermedia.html')
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
