/**
 * Terminal renderer: structured and compact modes via the new render pipeline.
 */

import { describe, expect, it } from 'vitest'
import { DIAGNOSTIC_BANNER_CHAR } from '../diagnostic-display'
import { terminalRenderer, formatDiagnosticsTerminal } from '../render/terminal'
import type { AeroDiagnostic } from '../types'

const diag: AeroDiagnostic = {
	code: 'AERO_COMPILE',
	severity: 'error',
	message: 'broken',
	file: 'pages/a.html',
	span: { file: 'pages/a.html', line: 1, column: 0 },
}

describe('terminalRenderer', () => {
	it('renderOne with banners includes banner characters and title', () => {
		const text = terminalRenderer.renderOne(diag, 0, 1, { banners: true })
		expect(text.startsWith(DIAGNOSTIC_BANNER_CHAR)).toBe(true)
		expect(text).toContain('Aero Compiler Error')
		expect(text).toContain('File: pages/a.html:1:0')
		expect(text).toContain('Error: broken')
		expect(text.endsWith(DIAGNOSTIC_BANNER_CHAR)).toBe(true)
	})

	it('renderOne without banners omits banner lines', () => {
		const text = terminalRenderer.renderOne(diag, 0, 1, { banners: false })
		expect(text).not.toContain(DIAGNOSTIC_BANNER_CHAR.repeat(5))
		expect(text).toContain('File: pages/a.html:1:0')
		expect(text).toContain('Error: broken')
	})

	it('renderOne compact mode produces [aero] format', () => {
		const text = terminalRenderer.renderOne(diag, 0, 1, { compact: true })
		expect(text).toContain('[aero]')
		expect(text).toContain('[AERO_COMPILE]')
		expect(text).toContain('pages/a.html:1:0')
	})

	it('renderDiagnostics joins multiple with double newlines', () => {
		const d2: AeroDiagnostic = { ...diag, message: 'also broken' }
		const text = terminalRenderer.renderDiagnostics([diag, d2], { banners: false })
		expect(text).toContain('broken')
		expect(text).toContain('also broken')
		expect(text).toContain('\n\n')
	})

	it('renderDiagnostics returns empty string for empty array', () => {
		expect(terminalRenderer.renderDiagnostics([])).toBe('')
	})
})

describe('formatDiagnosticsTerminal (compat wrapper)', () => {
	it('plain: true maps to compact mode', () => {
		const text = formatDiagnosticsTerminal([diag], { plain: true })
		expect(text).toContain('[aero]')
		expect(text).toContain('[AERO_COMPILE]')
	})

	it('pretty: true maps to banners mode', () => {
		const text = formatDiagnosticsTerminal([diag], { pretty: true })
		expect(text.startsWith(DIAGNOSTIC_BANNER_CHAR)).toBe(true)
	})

	it('pretty: false omits banners', () => {
		const text = formatDiagnosticsTerminal([diag], { pretty: false })
		expect(text).not.toContain('Aero Compiler Error')
		expect(text).toContain('File: pages/a.html:1:0')
	})
})
