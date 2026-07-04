import { describe, expect, it } from 'vitest'
import { normalizeAeroOptions, resolveContentOptions } from '../resolve-aero-options'

describe('resolveContentOptions', () => {
	it('returns empty object for content: true', () => {
		expect(resolveContentOptions(true)).toEqual({})
	})

	it('returns options object when content is an object', () => {
		expect(resolveContentOptions({ config: 'custom.config.ts' })).toEqual({
			config: 'custom.config.ts',
		})
	})

	it('returns undefined when content is omitted or false', () => {
		expect(resolveContentOptions(undefined)).toBeUndefined()
		expect(resolveContentOptions(false)).toBeUndefined()
	})
})

describe('normalizeAeroOptions', () => {
	it('defaults server, reactivity, and hypermedia to false', () => {
		expect(normalizeAeroOptions({})).toEqual({
			server: false,
			reactivity: false,
			hypermedia: false,
		})
	})

	it('preserves explicit flags and strips content', () => {
		expect(
			normalizeAeroOptions({
				content: true,
				server: true,
				reactivity: true,
				apiPrefix: '/internal-api',
			})
		).toEqual({
			server: true,
			reactivity: true,
			hypermedia: false,
			apiPrefix: '/internal-api',
		})
	})
})
