import { afterEach, describe, expect, it, vi } from 'vitest'
import { aeroDevLog } from '../dev-log'

describe('aeroDevLog', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('prefixes with [aero] [code] for warn and error', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const err = vi.spyOn(console, 'error').mockImplementation(() => {})
		aeroDevLog('warn', 'AERO_TEST', 'hello')
		expect(warn).toHaveBeenCalledWith('[aero] [AERO_TEST] hello')
		aeroDevLog('error', 'AERO_TEST', 'bad')
		expect(err).toHaveBeenCalledWith('[aero] [AERO_TEST] bad')
	})
})
