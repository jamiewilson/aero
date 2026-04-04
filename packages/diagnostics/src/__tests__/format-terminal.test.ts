/**
 * Terminal formatter: plain vs structured (banner) modes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIAGNOSTIC_BANNER_CHAR } from '../diagnostic-display'
import { formatDiagnosticsTerminal } from '../render/terminal'

function escapeRe(s: string): string {
	return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

const one = {
	code: 'AERO_COMPILE' as const,
	severity: 'error' as const,
	message: 'broken',
	file: 'pages/a.html',
	span: { file: 'pages/a.html', line: 1, column: 0 },
}

describe('formatDiagnosticsTerminal', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it('plain mode has legacy [aero] line and no banners', () => {
		const text = formatDiagnosticsTerminal([one], {
			plain: true,
			pretty: true,
		})
		expect(text).not.toContain(DIAGNOSTIC_BANNER_CHAR.repeat(7))
		expect(text).toContain('[aero]')
		expect(text).toContain('[AERO_COMPILE]')
		expect(text).toMatchInlineSnapshot(`
			"[aero] [AERO_COMPILE] pages/a.html:1:0
			  error: broken"
		`)
	})

	it('structured mode uses banner lines and File/Error lines', () => {
		const text = formatDiagnosticsTerminal([one], { pretty: true, plain: false })
		expect(text.startsWith(DIAGNOSTIC_BANNER_CHAR)).toBe(true)
		expect(text).toContain('Aero Compiler Error')
		expect(text).toContain('File: pages/a.html:1:0')
		expect(text).toContain('Error: broken')
		expect(text.endsWith(DIAGNOSTIC_BANNER_CHAR)).toBe(true)
	})

	it('pretty: false omits banners but keeps File/Error', () => {
		const text = formatDiagnosticsTerminal([one], { pretty: false, plain: false })
		expect(text).not.toContain('Aero Compiler Error')
		expect(text).not.toMatch(new RegExp(`^${escapeRe(DIAGNOSTIC_BANNER_CHAR)}+`))
		expect(text).toContain('File: pages/a.html:1:0')
		expect(text).toContain('Error: broken')
	})
})
