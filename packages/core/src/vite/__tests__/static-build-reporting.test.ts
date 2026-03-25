import {
	AERO_EXIT_BUILD_CANCELLED,
	AERO_EXIT_COMPILE,
	AERO_EXIT_NITRO,
	AeroBuildCancelledError,
} from '@aero-js/diagnostics'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStaticBuildReportingService } from '../static-build-reporting'

describe('createStaticBuildReportingService', () => {
	afterEach(() => {
		process.exitCode = undefined
		vi.restoreAllMocks()
	})

	it('reports cancelled prerender as warning and keeps bucketed exit code', () => {
		const service = createStaticBuildReportingService()
		const logger = { warn: vi.fn(), error: vi.fn() }
		const err = new AeroBuildCancelledError({ message: 'cancelled by test' })
		try {
			service.reportPrerenderFailure(err, logger)
		} catch (thrown) {
			expect(thrown).toBe(err)
		}
		expect(logger.warn).toHaveBeenCalledOnce()
		expect(logger.error).not.toHaveBeenCalled()
		expect(process.exitCode).toBe(AERO_EXIT_BUILD_CANCELLED)
	})

	it('reports non-cancel prerender failure as formatted error and rethrows', () => {
		const service = createStaticBuildReportingService()
		const logger = { warn: vi.fn(), error: vi.fn() }
		const err = new Error('boom')
		try {
			service.reportPrerenderFailure(err, logger)
		} catch (thrown) {
			expect(thrown).toBe(err)
		}
		expect(logger.error).toHaveBeenCalledOnce()
		expect(logger.warn).not.toHaveBeenCalled()
		expect(process.exitCode).toBe(AERO_EXIT_COMPILE)
	})

	it('reports nitro failure with nitro-specific exit code', () => {
		const service = createStaticBuildReportingService()
		const logger = { warn: vi.fn(), error: vi.fn() }
		const err = new Error('nitro failed')
		try {
			service.reportNitroFailure(err, logger)
		} catch (thrown) {
			expect(thrown).toBe(err)
		}
		expect(logger.error).toHaveBeenCalledOnce()
		expect(logger.warn).not.toHaveBeenCalled()
		expect(process.exitCode).toBe(AERO_EXIT_NITRO)
	})

	it('supports substituting metrics recorder service', () => {
		const record = vi.fn()
		const service = createStaticBuildReportingService({ recordMetrics: record })
		const logger = { warn: vi.fn(), error: vi.fn() }
		const err = new Error('boom')
		try {
			service.reportPrerenderFailure(err, logger)
		} catch {
			// expected
		}
		expect(record).toHaveBeenCalledOnce()
		expect(record.mock.calls[0]?.[0]).toBe('static-prerender')
	})
})
