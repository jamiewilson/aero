/**
 * Core re-exports SSR parse helpers from @aero-js/diagnostics; detailed tests live there.
 */
import { describe, expect, it } from 'vitest'
import {
	formatCondensedHtmlSsrParseError,
	isCondensableHtmlSsrParseError,
} from '../condense-ssr-parse-error'

describe('condense-ssr-parse-error re-export', () => {
	it('re-exports unified formatter', () => {
		const err = Object.assign(new Error('Unexpected token'), {
			code: 'PARSE_ERROR',
			id: '/a.html',
			loc: { file: '/a.html', line: 1, column: 1 },
		})
		expect(isCondensableHtmlSsrParseError(err)).toBe(true)
		expect(formatCondensedHtmlSsrParseError(err)).toContain('Aero Compiler Error')
	})
})
