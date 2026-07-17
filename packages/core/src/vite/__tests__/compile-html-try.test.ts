import { describe, expect, it } from 'vitest'
import { AeroCompileError, thrownToAeroDiagnostics } from '@aero-js/diagnostics'
import { htmlCompileTry } from '../compile-html-try'

describe('htmlCompileTry', () => {
	it('returns success value from sync thunk', () => {
		expect(htmlCompileTry('/proj/pages/a.html', () => 'export default {}')).toBe('export default {}')
	})

	it('maps thrown Error to AeroCompileError with importer file', () => {
		expect(() =>
			htmlCompileTry('/proj/pages/b.html', () => {
				throw new Error('compile failed')
			})
		).toThrow(AeroCompileError)

		const d = thrownToAeroDiagnostics(
			(() => {
				try {
					htmlCompileTry('/proj/pages/b.html', () => {
						throw new Error('compile failed')
					})
				} catch (err) {
					return err
				}
			})()
		)
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.message).toBe('compile failed')
		expect(d[0]!.file).toBe('/proj/pages/b.html')
	})

	it('preserves AeroCompileError including span', () => {
		const d = thrownToAeroDiagnostics(
			(() => {
				try {
					htmlCompileTry('/ignored.html', () => {
						throw new AeroCompileError({
							message: 'typed',
							file: 'real.html',
							line: 5,
							column: 0,
						})
					})
				} catch (err) {
					return err
				}
			})()
		)
		expect(d[0]!.span).toEqual({ file: 'real.html', line: 5, column: 0 })
	})

	it('maps duck-typed CompileError and preserves span', () => {
		const d = thrownToAeroDiagnostics(
			(() => {
				try {
					htmlCompileTry('/proj/pages/b.html', () => {
						const err = new Error(
							'Reactive class binding `class:is-active` must reference a declared state variable.'
						)
						err.name = 'CompileError'
						Object.assign(err, { file: '/proj/pages/b.html', line: 46, column: 9 })
						throw err
					})
				} catch (err) {
					return err
				}
			})()
		)
		expect(d[0]!.span).toEqual({ file: '/proj/pages/b.html', line: 46, column: 9 })
	})

	it('maps thrown non-Error values to compile diagnostics (no silent failure)', () => {
		const d = thrownToAeroDiagnostics(
			(() => {
				try {
					htmlCompileTry('/proj/pages/c.html', () => {
						throw 'not-an-error'
					})
				} catch (err) {
					return err
				}
			})()
		)
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.file).toBe('/proj/pages/c.html')
		expect(d[0]!.message).toContain('not-an-error')
	})
})
