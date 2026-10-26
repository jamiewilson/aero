import { afterEach, describe, expect, it } from 'vitest'

import { isAeroNitroEnabled } from '../aero-env'

describe('isAeroNitroEnabled', () => {
	const prev = process.env.AERO_SERVER

	afterEach(() => {
		if (prev === undefined) delete process.env.AERO_SERVER
		else process.env.AERO_SERVER = prev
	})

	it('respects server flag and AERO_SERVER=false', () => {
		delete process.env.AERO_SERVER
		expect(isAeroNitroEnabled(true)).toBe(true)
		expect(isAeroNitroEnabled(false)).toBe(false)

		process.env.AERO_SERVER = 'false'
		expect(isAeroNitroEnabled(true)).toBe(false)
	})
})
