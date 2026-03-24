import { describe, expect, it } from 'vitest'
import { Effect, Exit } from 'effect'
import { AeroCompileError, exitFailureToAeroDiagnostics } from '@aero-js/diagnostics'
import { htmlCompileTry } from '../compile-html-effect'

describe('htmlCompileTry', () => {
	it('returns success value from sync thunk', () => {
		const program = htmlCompileTry('/proj/pages/a.html', () => 'export default {}')
		expect(Effect.runSync(program)).toBe('export default {}')
	})

	it('maps thrown Error to failure channel with importer file', () => {
		const program = htmlCompileTry('/proj/pages/b.html', () => {
			throw new Error('compile failed')
		})
		const exit = Effect.runSyncExit(program)
		expect(Exit.isFailure(exit)).toBe(true)
		const d = exitFailureToAeroDiagnostics(exit)
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.message).toBe('compile failed')
		expect(d[0]!.file).toBe('/proj/pages/b.html')
	})

	it('preserves AeroCompileError including span', () => {
		const program = htmlCompileTry('/ignored.html', () => {
			throw new AeroCompileError({
				message: 'typed',
				file: 'real.html',
				line: 5,
				column: 0,
			})
		})
		const exit = Effect.runSyncExit(program)
		expect(Exit.isFailure(exit)).toBe(true)
		const d = exitFailureToAeroDiagnostics(exit)
		expect(d[0]!.span).toEqual({ file: 'real.html', line: 5, column: 0 })
	})

	it('maps thrown non-Error values to compile diagnostics (no silent failure)', () => {
		const program = htmlCompileTry('/proj/pages/c.html', () => {
			throw 'not-an-error'
		})
		const exit = Effect.runSyncExit(program)
		expect(Exit.isFailure(exit)).toBe(true)
		const d = exitFailureToAeroDiagnostics(exit)
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.file).toBe('/proj/pages/c.html')
		expect(d[0]!.message).toContain('not-an-error')
	})
})
