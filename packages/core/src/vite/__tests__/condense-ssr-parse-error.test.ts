/**
 * Core uses @aero-js/diagnostics for condensed SSR HTML parse errors; detailed tests live there.
 */
import { describe, expect, it } from 'vitest'
import {
	formatCondensedHtmlSsrParseError,
	isCondensableHtmlSsrParseError,
} from '@aero-js/diagnostics'

describe('HTML SSR parse error helpers (diagnostics)', () => {
	it('formats condensable Rolldown HTML parse errors', () => {
		const err = Object.assign(new Error('Unexpected token'), {
			code: 'PARSE_ERROR',
			id: '/a.html',
			loc: { file: '/a.html', line: 1, column: 1 },
		})
		expect(isCondensableHtmlSsrParseError(err)).toBe(true)
		expect(formatCondensedHtmlSsrParseError(err)).toContain('Aero Compiler Error')
	})
})
