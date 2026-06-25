import { describe, expect, it } from 'vitest'
import { SignalStore } from '../store'

describe('SignalStore', () => {
	it('creates and reads signals by path', () => {
		const store = new SignalStore()
		store.signal('count', 1)
		expect(store.get<number>('count').value).toBe(1)
	})

	it('merges nested objects into dot-path signals', () => {
		const store = new SignalStore()
		store.merge({ user: { name: 'Ada', age: 37 } })
		expect(store.get<string>('user.name').value).toBe('Ada')
		expect(store.get<number>('user.age').value).toBe(37)
	})

	it('evaluates expressions with $ refs', () => {
		const store = new SignalStore()
		store.merge({ count: 2, user: { age: 3 } })
		expect(store.evaluate('$count + $user.age')).toBe(5)
	})

	it('returns nested snapshot', () => {
		const store = new SignalStore()
		store.merge({ count: 1, user: { name: 'Ada' } })
		expect(store.snapshot()).toEqual({ count: 1, user: { name: 'Ada' } })
	})
})
