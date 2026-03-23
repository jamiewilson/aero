import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	getDiagnosticsMetricsSnapshot,
	recordDiagnosticsMetrics,
	resetDiagnosticsMetrics,
	startDebugSpan,
} from '../observability'
import type { AeroDiagnostic } from '../types'

describe('observability', () => {
	afterEach(() => {
		resetDiagnosticsMetrics()
		vi.restoreAllMocks()
		vi.unstubAllEnvs()
	})

	it('records counters by code and surface', () => {
		const rows: AeroDiagnostic[] = [
			{ code: 'AERO_COMPILE', severity: 'error', message: 'x' },
			{ code: 'AERO_COMPILE', severity: 'error', message: 'y' },
			{ code: 'AERO_CONTENT_SCHEMA', severity: 'error', message: 'z' },
		]
		recordDiagnosticsMetrics('cli-check', rows)
		const snap = getDiagnosticsMetricsSnapshot()
		expect(snap.total).toBe(3)
		expect(snap.bySurface['cli-check']).toBe(3)
		expect(snap.byCode.AERO_COMPILE).toBe(2)
		expect(snap.byCode.AERO_CONTENT_SCHEMA).toBe(1)
	})

	it('does not emit debug logs when AERO_LOG is not debug', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
		recordDiagnosticsMetrics('cli-check', [
			{ code: 'AERO_COMPILE', severity: 'error', message: 'x' },
		])
		startDebugSpan('unit-test').end('ok')
		expect(spy).not.toHaveBeenCalled()
	})

	it('emits debug logs when AERO_LOG=debug', () => {
		vi.stubEnv('AERO_LOG', 'debug')
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
		recordDiagnosticsMetrics('cli-check', [
			{ code: 'AERO_COMPILE', severity: 'error', message: 'x' },
		])
		startDebugSpan('unit-test').end('ok')
		expect(spy).toHaveBeenCalled()
		expect(spy.mock.calls.map(c => String(c[0])).join('\n')).toContain('metrics[cli-check]')
		expect(spy.mock.calls.map(c => String(c[0])).join('\n')).toContain('span:start unit-test')
	})
})

