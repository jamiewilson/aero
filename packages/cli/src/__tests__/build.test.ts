import { describe, expect, it } from 'vitest'
import { AeroBuildCancelledError, AERO_EXIT_BUILD_CANCELLED } from '@aero-js/diagnostics'
import { resolveAeroBuildExitCode } from '../build'

describe('resolveAeroBuildExitCode', () => {
	it('returns 0 when build succeeds without setting exitCode', () => {
		const prev = process.exitCode
		process.exitCode = undefined
		expect(resolveAeroBuildExitCode()).toBe(0)
		process.exitCode = prev
	})

	it('returns process.exitCode when set without an error', () => {
		const prev = process.exitCode
		process.exitCode = 12
		expect(resolveAeroBuildExitCode()).toBe(12)
		process.exitCode = prev
	})

	it('maps AeroBuildCancelledError to AERO_EXIT_BUILD_CANCELLED', () => {
		expect(
			resolveAeroBuildExitCode(new AeroBuildCancelledError({ message: 'cancelled by test' }))
		).toBe(AERO_EXIT_BUILD_CANCELLED)
	})
})
