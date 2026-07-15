import {
	AERO_EXIT_BUILD_CANCELLED,
	AERO_EXIT_BUILD_GENERIC,
	AERO_EXIT_COMPILE,
	AERO_EXIT_NITRO,
	AeroBuildCancelledError,
	AeroCompileError,
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

	it('reports Aero compile failures as formatted error and rethrows', () => {
		const service = createStaticBuildReportingService()
		const logger = createLoggerSpies()
		const err = new AeroCompileError({ message: 'boom', file: '/app/page.html' })
		expectRethrowsSame(() => service.reportPrerenderFailure(err, logger), err)
		expect(logger.error).toHaveBeenCalledOnce()
		expect(logger.warn).not.toHaveBeenCalled()
		expect(process.exitCode).toBe(AERO_EXIT_COMPILE)
		expect(String(logger.error.mock.calls[0]?.[0])).toContain('boom')
	})

	it('leaves non-Aero prerender failures as native logger output', () => {
		const service = createStaticBuildReportingService()
		const logger = createLoggerSpies()
		const err = new Error('esbuild failed')
		expectRethrowsSame(() => service.reportPrerenderFailure(err, logger), err)
		expect(logger.error).toHaveBeenCalledOnce()
		expect(String(logger.error.mock.calls[0]?.[0])).toContain('esbuild failed')
		expect(String(logger.error.mock.calls[0]?.[0])).not.toContain('[AERO_')
		expect(process.exitCode).toBe(AERO_EXIT_BUILD_GENERIC)
	})

	it('normalizes Vite-shaped Aero prerender errors without dumping pluginCode', () => {
		const service = createStaticBuildReportingService()
		const logger = createLoggerSpies()
		const err = Object.assign(new Error('[AERO_COMPILE] /app/client/pages/index.html:3:4: bad state'), {
			id: '/app/client/pages/index.html',
			loc: { file: '/app/client/pages/index.html', line: 3, column: 4 },
			frame: '> 3 | bad state\n    |    ^',
			plugin: 'vite-plugin-aero-transform',
			pluginCode: '<html>noisy transformed template</html>',
		})

		expectRethrowsSame(() => service.reportPrerenderFailure(err, logger), err)

		const output = String(logger.error.mock.calls[0]?.[0])
		expect(output).toContain('bad state')
		expect(output).not.toContain('pluginCode')
		expect(output).not.toContain('noisy transformed template')
	})

	it('reports nitro failure with nitro-specific exit code and native message', () => {
		const service = createStaticBuildReportingService()
		const logger = createLoggerSpies()
		const err = new Error('nitro failed')
		expectRethrowsSame(() => service.reportNitroFailure(err, logger), err)
		expect(logger.error).toHaveBeenCalledOnce()
		expect(logger.warn).not.toHaveBeenCalled()
		expect(String(logger.error.mock.calls[0]?.[0])).toContain('nitro failed')
		expect(String(logger.error.mock.calls[0]?.[0])).not.toContain('[AERO_')
		expect(process.exitCode).toBe(AERO_EXIT_NITRO)
	})

	it('supports substituting metrics recorder service', () => {
		const record = vi.fn()
		const service = createStaticBuildReportingService({ recordMetrics: record })
		const logger = createLoggerSpies()
		const err = new AeroCompileError({ message: 'boom' })
		expectRethrowsSame(() => service.reportPrerenderFailure(err, logger), err)
		expect(record).toHaveBeenCalledOnce()
		expect(record.mock.calls[0]?.[0]).toBe('static-prerender')
	})
})
