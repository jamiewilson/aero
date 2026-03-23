import {
	AERO_EXIT_COMPILE,
	exitCodeForDiagnostics,
	exitFailureToAeroDiagnostics,
	unknownToAeroDiagnostics,
} from '@aero-js/diagnostics'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { htmlCompileTry } from '../compile-html-effect'
import { createStaticBuildReportingService } from '../static-build-reporting'

describe('failure parity across entry points', () => {
	it('maps compile-class failures to AERO_COMPILE and compile exit bucket', () => {
		// Vite compile wrapper path
		const compileExit = Effect.runSyncExit(
			htmlCompileTry('/proj/pages/bad.html', () => {
				throw new Error('compile failed')
			})
		)
		const compileDiags = exitFailureToAeroDiagnostics(compileExit)
		expect(compileDiags[0]?.code).toBe('AERO_COMPILE')
		expect(exitCodeForDiagnostics(compileDiags)).toBe(AERO_EXIT_COMPILE)

		// Generic thrown path normalized with compile base code
		const unknownDiags = unknownToAeroDiagnostics(new Error('compile failed'), {
			code: 'AERO_COMPILE',
		})
		expect(unknownDiags[0]?.code).toBe('AERO_COMPILE')
		expect(exitCodeForDiagnostics(unknownDiags)).toBe(AERO_EXIT_COMPILE)

		// Static build reporting prerender failure path
		const reporting = createStaticBuildReportingService()
		const logger = { warn: () => {}, error: () => {} }
		process.exitCode = undefined
		try {
			reporting.reportPrerenderFailure(new Error('compile failed'), logger)
		} catch {
			// expected rethrow
		}
		expect(process.exitCode).toBe(AERO_EXIT_COMPILE)
	})
})

