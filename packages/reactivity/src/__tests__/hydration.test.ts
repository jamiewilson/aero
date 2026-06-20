import { describe, expect, it } from 'vitest'
import { readHydrationState } from '../hydration'

describe('readHydrationState', () => {
	it('reads and parses aero/state payload', () => {
		const root = {
			querySelector: () => ({ textContent: '{"count":1,"user":{"name":"Ada"}}' }),
		}
		expect(readHydrationState(root)).toEqual({ count: 1, user: { name: 'Ada' } })
	})

	it('returns empty object when payload missing or invalid', () => {
		const missingRoot = { querySelector: () => null }
		expect(readHydrationState(missingRoot)).toEqual({})
		const invalidRoot = {
			querySelector: () => ({ textContent: 'not-json' }),
		}
		expect(readHydrationState(invalidRoot)).toEqual({})
	})
})
