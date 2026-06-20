import { describe, expect, it, vi, beforeEach } from 'vitest'

const aeroSpy = vi.fn(() => ({ name: 'aero-plugin' }))
const aeroContentSpy = vi.fn(() => ({ name: 'aero-content-plugin' }))

vi.mock('@aero-js/vite', () => ({
	aero: (options: unknown) => aeroSpy(options),
}))

vi.mock('@aero-js/content/vite', () => ({
	aeroContent: (options: unknown) => aeroContentSpy(options),
}))

import { createViteConfig } from '../createViteConfig'

describe('createViteConfig feature flags', () => {
	beforeEach(() => {
		aeroSpy.mockClear()
		aeroContentSpy.mockClear()
	})

	it('passes reactivity/hypermedia flags to aero plugin', () => {
		createViteConfig(
			{
				reactivity: true,
				hypermedia: true,
			},
			{ command: 'dev', mode: 'development' }
		)

		expect(aeroSpy).toHaveBeenCalledTimes(1)
		expect(aeroSpy.mock.calls[0]?.[0]).toMatchObject({
			reactivity: true,
			hypermedia: true,
		})
	})

	it('defaults reactivity/hypermedia to false when omitted', () => {
		createViteConfig({}, { command: 'dev', mode: 'development' })

		expect(aeroSpy).toHaveBeenCalledTimes(1)
		expect(aeroSpy.mock.calls[0]?.[0]).toMatchObject({
			reactivity: false,
			hypermedia: false,
		})
	})
})
