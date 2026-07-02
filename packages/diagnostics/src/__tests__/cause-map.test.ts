import { describe, expect, it } from 'vitest'
import { AeroCompileError } from '../tagged-errors'
import { failureToAeroDiagnostics, thrownToAeroDiagnostics } from '../cause-map'

describe('failureToAeroDiagnostics', () => {
	it('maps AeroCompileError to AERO_COMPILE with span', () => {
		const err = new AeroCompileError({
			message: 'bad each',
			file: 'pages/x.html',
			line: 3,
			column: 0,
		})
		const d = failureToAeroDiagnostics(err)
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

	it('collects multiple failures from AggregateError', () => {
		const a = new AeroCompileError({ message: 'first', file: 'a.html' })
		const b = new AeroCompileError({ message: 'second', file: 'b.html' })
		const d = failureToAeroDiagnostics(new AggregateError([a, b], 'multiple'))
		expect(d.length).toBeGreaterThanOrEqual(2)
		expect(d.map(x => x.message).sort()).toEqual(['first', 'second'].sort())
	})

	it('maps plain Error to AERO_COMPILE', () => {
		const d = failureToAeroDiagnostics(new Error('plain'))
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.message).toBe('plain')
	})
})

describe('thrownToAeroDiagnostics', () => {
	it('maps thrown AeroCompileError', () => {
		const d = thrownToAeroDiagnostics(
			new AeroCompileError({ message: 'oops', file: 'f.html' })
		)
		expect(d).toHaveLength(1)
		expect(d[0]!.message).toBe('oops')
	})
})
