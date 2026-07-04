import { describe, expect, it, vi, beforeEach } from 'vitest'

const aeroSpy = vi.fn((_options?: unknown) => [{ name: 'aero-plugin' }])

vi.mock('../../vite/index', () => ({
	aero: (options: unknown) => aeroSpy(options),
}))

import { createViteConfig } from '../createViteConfig'

describe('createViteConfig feature flags', () => {
	beforeEach(() => {
		aeroSpy.mockClear()
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

	it('passes content and apiPrefix through to aero()', () => {
		createViteConfig(
			{
				content: true,
				apiPrefix: '/internal-api',
			},
			{ command: 'dev', mode: 'development' }
		)

		expect(aeroSpy).toHaveBeenCalledTimes(1)
		expect(aeroSpy.mock.calls[0]?.[0]).toMatchObject({
			content: true,
			apiPrefix: '/internal-api',
		})
	})
})
