import { describe, expect, it } from 'vitest'
import { readAeroJsonPayload, readHydrationState, reviveStateValue } from '../hydration'

describe('readHydrationState', () => {
	it('reads and parses application/json state payload', () => {
		const root = {
			querySelector: (selector: string) =>
				selector === 'script[type="application/json"][data-aero="state"]'
					? { textContent: '{"count":1,"user":{"name":"Ada"}}' }
					: null,
		}
		expect(readHydrationState(root)).toEqual({ count: 1, user: { name: 'Ada' } })
	})

	it('readAeroJsonPayload ignores non-state application/json blocks', () => {
		const root = {
			querySelector: (selector: string) =>
				selector === 'script[type="application/json"][data-aero="state"]'
					? null
					: selector === 'script[type="application/json"][data-aero="props"]'
						? { textContent: '{"ignored":true}' }
						: null,
		}
		expect(readAeroJsonPayload('state', root)).toEqual({})
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
			querySelector: (selector: string) =>
				selector === 'script[type="application/json"][data-aero="state"]'
					? {
							textContent: JSON.stringify({
								numbersMap: { __aero: 'Map', entries: [[1, 'one']] },
								numbersSet: { __aero: 'Set', values: [1, 2] },
							}),
						}
					: null,
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
