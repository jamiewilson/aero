import {
	AERO_EXIT_BUILD_CANCELLED,
	AERO_EXIT_COMPILE,
	AERO_EXIT_NITRO,
	AeroBuildCancelledError,
} from '@aero-js/diagnostics'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStaticBuildReportingService } from '../static-build-reporting'

function createLoggerSpies() {
	return { warn: vi.fn(), error: vi.fn() }
}

function expectRethrowsSame(fn: () => void, expected: unknown): void {
	try {
		fn()
	} catch (thrown) {
		expect(thrown).toBe(expected)
	}
}

describe('createStaticBuildReportingService', () => {
	afterEach(() => {
		process.exitCode = undefined
		vi.restoreAllMocks()
	})

	it('reports cancelled prerender as warning and keeps bucketed exit code', () => {
		const service = createStaticBuildReportingService()
		const logger = createLoggerSpies()
		const err = new AeroBuildCancelledError({ message: 'cancelled by test' })
		expectRethrowsSame(() => service.reportPrerenderFailure(err, logger), err)
		expect(logger.warn).toHaveBeenCalledOnce()
		expect(logger.error).not.toHaveBeenCalled()
		expect(process.exitCode).toBe(AERO_EXIT_BUILD_CANCELLED)
	})

	it('reports non-cancel prerender failure as formatted error and rethrows', () => {
		const service = createStaticBuildReportingService()
		const logger = createLoggerSpies()
		const err = new Error('boom')
		expectRethrowsSame(() => service.reportPrerenderFailure(err, logger), err)
		expect(logger.error).toHaveBeenCalledOnce()
		expect(logger.warn).not.toHaveBeenCalled()
		expect(process.exitCode).toBe(AERO_EXIT_COMPILE)
	})

	it('reports nitro failure with nitro-specific exit code', () => {
		const service = createStaticBuildReportingService()
		const logger = createLoggerSpies()
		const err = new Error('nitro failed')
		expectRethrowsSame(() => service.reportNitroFailure(err, logger), err)
		expect(logger.error).toHaveBeenCalledOnce()
		expect(logger.warn).not.toHaveBeenCalled()
		expect(process.exitCode).toBe(AERO_EXIT_NITRO)
	})

	it('supports substituting metrics recorder service', () => {
		const record = vi.fn()
		const service = createStaticBuildReportingService({ recordMetrics: record })
		const logger = createLoggerSpies()
		const err = new Error('boom')
		expectRethrowsSame(() => service.reportPrerenderFailure(err, logger), err)
		expect(record).toHaveBeenCalledOnce()
		expect(record.mock.calls[0]?.[0]).toBe('static-prerender')
	})
})
