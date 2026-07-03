import { describe, expect, it } from 'vitest'
import { readHydrationState, reviveStateValue } from '../hydration'

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

	it('revives Map and Set markers from hydration payload', () => {
		const root = {
			querySelector: () => ({
				textContent: JSON.stringify({
					numbersMap: { __aero: 'Map', entries: [[1, 'one']] },
					numbersSet: { __aero: 'Set', values: [1, 2] },
				}),
			}),
		}
		const state = readHydrationState(root)
		expect(state.numbersMap).toBeInstanceOf(Map)
		expect((state.numbersMap as Map<number, string>).get(1)).toBe('one')
		expect(state.numbersSet).toBeInstanceOf(Set)
		expect([...(state.numbersSet as Set<number>)]).toEqual([1, 2])
	})

	it('reviveStateValue deep-walks nested objects', () => {
		const revived = reviveStateValue({
			formModel: { tags: { __aero: 'Set', values: ['a'] } },
		}) as { formModel: { tags: Set<string> } }
		expect(revived.formModel.tags).toBeInstanceOf(Set)
		expect([...revived.formModel.tags]).toEqual(['a'])
	})
})
