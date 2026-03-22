import { describe, expect, it } from 'vitest'
import {
	formatCondensedHtmlSsrParseError,
	htmlSsrParseErrorToAeroDiagnostic,
	isCondensableHtmlSsrParseError,
} from '../html-ssr-parse-error'

describe('html-ssr-parse-error', () => {
	it('detects PARSE_ERROR on html module', () => {
		const err = Object.assign(new Error('Parse failure: x\nAt file: /a/nav.html:2:1'), {
			code: 'PARSE_ERROR',
			id: '/a/nav.html',
			loc: { file: '/a/nav.html', line: 25, column: 3 },
		})
		expect(isCondensableHtmlSsrParseError(err)).toBe(true)
	})

	it('ignores PARSE_ERROR on ts files', () => {
		const err = Object.assign(new Error('x'), {
			code: 'PARSE_ERROR',
			id: '/proj/foo.ts',
		})
		expect(isCondensableHtmlSsrParseError(err)).toBe(false)
	})

	it('maps to AeroDiagnostic with unified message prefix', () => {
		const err = Object.assign(new Error('Unexpected token'), {
			code: 'PARSE_ERROR',
			id: '/p/x.html',
			loc: { file: '/p/x.html', line: 2, column: 1 },
		})
		const d = htmlSsrParseErrorToAeroDiagnostic(err)
		expect(d.code).toBe('AERO_COMPILE')
		expect(d.message).toContain('SSR parse')
		expect(d.message).toContain('Unexpected token')
		expect(d.hint).toBeTruthy()
	})

	it('formats like other terminal diagnostics (frame + [aero])', () => {
		const err = Object.assign(
			new Error(
				'Parse failure: Parse failed with 1 error:\nUnexpected token\n\n23: x\nAt file: /frontend/nav.html:25:3'
			),
			{
				code: 'PARSE_ERROR',
				id: '/frontend/nav.html',
				loc: { file: '/frontend/nav.html', line: 25, column: 3 },
				frame: '23 | a\n24 | b\n25 | c\n   | ^',
			}
		)
		const out = formatCondensedHtmlSsrParseError(err)
		expect(out).toContain('[aero]')
		expect(out).toContain('[AERO_COMPILE]')
		expect(out).toContain('/frontend/nav.html:25:3')
		expect(out).toContain('Unexpected token')
		expect(out).toContain('23 | a')
		expect(out).not.toMatch(/at async fetchModule/)
	})
})
