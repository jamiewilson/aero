/**
 * Shared error-to-diagnostic mapping functions.
 */

import { describe, expect, it } from 'vitest'
import {
	cancelledErrorToDiagnostic,
	compileErrorToDiagnostic,
	genericErrorToDiagnostic,
	unknownValueToDiagnostic,
} from '../error-to-diagnostic'
import { AeroBuildCancelledError, AeroCompileError } from '../tagged-errors'

describe('compileErrorToDiagnostic', () => {
	it('maps AeroCompileError with full span', () => {
		const err = new AeroCompileError({ message: 'bad', file: 'x.html', line: 1, column: 2 })
		const d = compileErrorToDiagnostic(err)
		expect(d.code).toBe('AERO_COMPILE')
		expect(d.severity).toBe('error')
		expect(d.message).toBe('bad')
		expect(d.file).toBe('x.html')
		expect(d.span).toEqual({ file: 'x.html', line: 1, column: 2 })
	})

	it('omits span when file/line not present', () => {
		const err = new AeroCompileError({ message: 'bad' })
		const d = compileErrorToDiagnostic(err)
		expect(d.span).toBeUndefined()
		expect(d.file).toBeUndefined()
	})
})

describe('cancelledErrorToDiagnostic', () => {
	it('maps with warning severity', () => {
		const err = new AeroBuildCancelledError({ message: 'stopped' })
		const d = cancelledErrorToDiagnostic(err)
		expect(d.code).toBe('AERO_INTERNAL')
		expect(d.severity).toBe('warning')
		expect(d.message).toBe('stopped')
	})

	it('uses default message when none provided', () => {
		const err = new AeroBuildCancelledError({})
		const d = cancelledErrorToDiagnostic(err)
		expect(d.message).toBe('Static build cancelled')
	})
})

describe('genericErrorToDiagnostic', () => {
	it('maps plain Error with message', () => {
		const err = new Error('oops')
		const d = genericErrorToDiagnostic(err)
		expect(d.code).toBe('AERO_COMPILE')
		expect(d.severity).toBe('error')
		expect(d.message).toBe('oops')
	})

	it('accepts custom code', () => {
		const err = new Error('cfg')
		const d = genericErrorToDiagnostic(err, 'AERO_CONFIG')
		expect(d.code).toBe('AERO_CONFIG')
	})
})

describe('unknownValueToDiagnostic', () => {
	it('maps string to diagnostic', () => {
		const d = unknownValueToDiagnostic('fail')
		expect(d.message).toBe('fail')
		expect(d.code).toBe('AERO_INTERNAL')
	})

	it('maps object to Unknown failure string', () => {
		const d = unknownValueToDiagnostic({ x: 1 })
		expect(d.message).toContain('Unknown failure')
	})
})
