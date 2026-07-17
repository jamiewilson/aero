import {
	AERO_EXIT_COMPILE,
	AeroCompileError,
	exitCodeForDiagnostics,
	thrownToAeroDiagnostics,
	unknownToAeroDiagnostics,
} from '@aero-js/diagnostics'
import { describe, expect, it } from 'vitest'
import { htmlCompileTry } from '../compile-html-try'
import { createStaticBuildReportingService } from '../static-build-reporting'

describe('failure parity across entry points', () => {
	it('maps compile-class failures to AERO_COMPILE and compile exit bucket', () => {
		let compileErr: unknown
		try {
			htmlCompileTry('/proj/pages/bad.html', () => {
				throw new Error('compile failed')
			})
		} catch (err) {
			compileErr = err
		}
		const compileDiags = thrownToAeroDiagnostics(compileErr)
		expect(compileDiags[0]?.code).toBe('AERO_COMPILE')
		expect(exitCodeForDiagnostics(compileDiags)).toBe(AERO_EXIT_COMPILE)

		const unknownDiags = unknownToAeroDiagnostics(new Error('compile failed'), {
			code: 'AERO_COMPILE',
		})
		expect(unknownDiags[0]?.code).toBe('AERO_COMPILE')
		expect(exitCodeForDiagnostics(unknownDiags)).toBe(AERO_EXIT_COMPILE)

		const reporting = createStaticBuildReportingService()
		const logger = { warn: () => {}, error: () => {} }
		process.exitCode = undefined
		try {
			reporting.reportPrerenderFailure(
				new AeroCompileError({ message: 'compile failed' }),
				logger
			)
		} catch {
			// expected rethrow
		}
		expect(process.exitCode).toBe(AERO_EXIT_COMPILE)
	})
})
