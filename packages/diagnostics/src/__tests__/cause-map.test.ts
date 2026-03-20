import { describe, expect, it } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { AeroCompileError } from '../tagged-errors'
import { exitFailureToAeroDiagnostics, mapCauseToAeroDiagnostics } from '../cause-map'

describe('mapCauseToAeroDiagnostics', () => {
	it('maps AeroCompileError to AERO_COMPILE with span', () => {
		const err = new AeroCompileError({
			message: 'bad each',
			file: 'pages/x.html',
			line: 3,
			column: 0,
		})
		const cause = Cause.fail(err)
		const d = mapCauseToAeroDiagnostics(cause)
		expect(d).toHaveLength(1)
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.message).toBe('bad each')
		expect(d[0]!.file).toBe('pages/x.html')
		expect(d[0]!.span).toEqual({
			file: 'pages/x.html',
			line: 3,
			column: 0,
		})
	})

	it('collects multiple failures from parallel Cause', () => {
		const a = new AeroCompileError({ message: 'first', file: 'a.html' })
		const b = new AeroCompileError({ message: 'second', file: 'b.html' })
		const cause = Cause.parallel(Cause.fail(a), Cause.fail(b))
		const d = mapCauseToAeroDiagnostics(cause)
		expect(d.length).toBeGreaterThanOrEqual(2)
		expect(d.map(x => x.message).sort()).toEqual(['first', 'second'].sort())
	})

	it('maps plain Error in fail to AERO_COMPILE', () => {
		const d = mapCauseToAeroDiagnostics(Cause.fail(new Error('plain')))
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.message).toBe('plain')
	})
})

describe('exitFailureToAeroDiagnostics', () => {
	it('returns diagnostics for failed Exit', () => {
		const program = Effect.fail(new AeroCompileError({ message: 'oops', file: 'f.html' }))
		const exit = Effect.runSyncExit(program)
		expect(Exit.isFailure(exit)).toBe(true)
		const d = exitFailureToAeroDiagnostics(exit)
		expect(d).toHaveLength(1)
		expect(d[0]!.message).toBe('oops')
	})

	it('returns empty array for success Exit', () => {
		const exit = Effect.runSyncExit(Effect.succeed(42))
		expect(exitFailureToAeroDiagnostics(exit)).toEqual([])
	})
})
