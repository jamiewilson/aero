/**
 * Terminal formatter: plain vs pretty (decoration) modes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDiagnosticsTerminal } from '../format-terminal'

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

	it('plain mode has no rule lines', () => {
		const text = formatDiagnosticsTerminal([one], {
			plain: true,
			pretty: true,
		})
		expect(text).not.toContain('─')
		expect(text).toContain('[AERO_COMPILE]')
	})

	it('pretty: true wraps in rule lines', () => {
		const text = formatDiagnosticsTerminal([one], { pretty: true, plain: false })
		expect(text.startsWith('─')).toBe(true)
		expect(text).toContain('aero (1)')
		expect(text).toContain('[AERO_COMPILE]')
		expect(text.endsWith('─\n') || text.endsWith('─')).toBe(true)
	})

	it('pretty: false skips rules (CI-style)', () => {
		const text = formatDiagnosticsTerminal([one], { pretty: false })
		expect(text).not.toContain('aero (1)')
		expect(text).toContain('[AERO_COMPILE]')
	})
})
