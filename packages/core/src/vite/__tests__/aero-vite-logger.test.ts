import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDiagnosticLogGate } from '@aero-js/diagnostics'
import { createAeroSsrHmrLogger, wrapAeroViteLogger } from '../aero-vite-logger'

describe('createAeroSsrHmrLogger', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('skips plugin-tagged Vite errors so Vite owns console output', () => {
		const error = Object.assign(new Error('Transform failed'), {
			plugin: 'vite:oxc',
			id: 'content/site.ts',
		})
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

		createAeroSsrHmrLogger().error(error)

		expect(spy).not.toHaveBeenCalled()
	})

	it('skips Aero Vite errors so Vite owns console output and pluginCode is not dumped', () => {
		const error = Object.assign(new Error('Hypermedia actions must be imported'), {
			id: path.join(process.cwd(), 'client/pages/demos/hypermedia.html'),
			loc: {
				file: path.join(process.cwd(), 'client/pages/demos/hypermedia.html'),
				line: 8,
				column: 1,
			},
			frame: '> 8 | GET()\n    | ^',
			plugin: 'vite-plugin-aero-transform',
			pluginCode: '<base-layout>' + '<p>noisy markup</p>'.repeat(20) + '</base-layout>',
		})
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

		createAeroSsrHmrLogger().error(error)

		expect(spy).not.toHaveBeenCalled()
	})

	it('skips runtime-instance HMR noise around Aero compile errors', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		const logger = createAeroSsrHmrLogger()

		logger.error(
			'Failed to reload virtual:aero/runtime-instance.ts. This could be due to syntax errors or importing non-existent modules. (see errors above)'
		)
		logger.debug('hot updated: virtual:aero/runtime-instance.ts')

		expect(spy).not.toHaveBeenCalled()
		expect(logSpy).not.toHaveBeenCalled()
	})

	it('prints message/stack for unknown errors without dumping enumerable metadata', () => {
		const error = Object.assign(new Error('boom'), {
			pluginCode: '<html>noisy</html>',
		})
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

		createAeroSsrHmrLogger().error(error)

		const output = spy.mock.calls.map(args => args.join(' ')).join('\n')
		expect(output).toContain('boom')
		expect(output).not.toContain('pluginCode')
		expect(output).not.toContain('<html>noisy</html>')
	})
})

describe('wrapAeroViteLogger', () => {
	it('passes Aero errors through to Vite default formatting', () => {
		const gate = createDiagnosticLogGate()
		const baseError = vi.fn()
		const wrapped = wrapAeroViteLogger({ error: baseError } as any, gate)
		const err = {
			message: 'Hypermedia actions must be imported',
			id: '/tmp/hypermedia.html',
			loc: { file: '/tmp/hypermedia.html', line: 13, column: 8 },
			plugin: 'vite-plugin-aero-transform',
		}

		wrapped.error('Internal server error: Hypermedia actions must be imported', { error: err })

		expect(baseError).toHaveBeenCalledTimes(1)
		expect(baseError.mock.calls[0]![0]).toBe(
			'Internal server error: Hypermedia actions must be imported'
		)
	})

	it('dedupes Vite default Aero error blocks by diagnostic fingerprint', () => {
		const gate = createDiagnosticLogGate()
		const baseError = vi.fn()
		const wrapped = wrapAeroViteLogger({ error: baseError } as any, gate)
		const err = {
			message: 'Hypermedia actions must be imported',
			id: '/tmp/hypermedia.html',
			loc: { file: '/tmp/hypermedia.html', line: 13, column: 8 },
			plugin: 'vite-plugin-aero-transform',
		}

		wrapped.error('Pre-transform error: Hypermedia actions must be imported', { error: err })
		wrapped.error('Internal server error: Hypermedia actions must be imported', { error: err })

		expect(baseError).toHaveBeenCalledTimes(1)
		expect(baseError.mock.calls[0]![0]).toBe(
			'Pre-transform error: Hypermedia actions must be imported'
		)
	})
})
