/**
 * Diagnostic fingerprint / log-gate unit tests.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import {
	createDiagnosticLogGate,
	diagnosticFingerprint,
	diagnosticsFingerprint,
} from '../diagnostic-log-gate'
import type { AeroDiagnostic } from '../types'

const one: AeroDiagnostic = {
	code: 'AERO_COMPILE',
	severity: 'error',
	message: 'Hypermedia actions must be imported',
	file: 'client/pages/demos/hypermedia.html',
	span: { file: 'client/pages/demos/hypermedia.html', line: 13, column: 8 },
}

describe('diagnosticFingerprint', () => {
	it('ignores AERO/location decorations in the message', () => {
		const decorated: AeroDiagnostic = {
			...one,
			message:
				'[AERO_COMPILE] client/pages/demos/hypermedia.html:13:8: Hypermedia actions must be imported',
		}
		expect(diagnosticFingerprint(decorated)).toBe(diagnosticFingerprint(one))
	})

	it('joins multiple diagnostics', () => {
		const two = { ...one, message: 'other' }
		expect(diagnosticsFingerprint([one, two])).toContain('\n')
	})
})

describe('createDiagnosticLogGate', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('allows the first log and suppresses duplicates within TTL', () => {
		const gate = createDiagnosticLogGate({ ttlMs: 5000 })
		expect(gate.shouldLog([one])).toBe(true)
		expect(gate.shouldLog([one])).toBe(false)
		expect(gate.shouldLog([one])).toBe(false)
	})

	it('allows logging again after TTL expires', () => {
		vi.useFakeTimers()
		const gate = createDiagnosticLogGate({ ttlMs: 1000 })
		expect(gate.shouldLog([one])).toBe(true)
		vi.advanceTimersByTime(1001)
		expect(gate.shouldLog([one])).toBe(true)
	})

	it('reset clears suppression', () => {
		const gate = createDiagnosticLogGate()
		expect(gate.shouldLog([one])).toBe(true)
		gate.reset()
		expect(gate.shouldLog([one])).toBe(true)
	})
})
