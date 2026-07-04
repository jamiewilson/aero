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

	it('mergeBindings keeps one signal per top-level key', () => {
		const store = new SignalStore()
		store.mergeBindings({ formModel: { email: 'a@b.c' }, count: 1 })
		expect(store.get<{ email: string }>('formModel').value).toEqual({ email: 'a@b.c' })
		expect(store.get<number>('count').value).toBe(1)
		expect(() => store.get('formModel.email')).toThrow(/Missing signal path/)
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

	it('aliases an existing signal entry without creating a new signal', () => {
		const store = new SignalStore()
		const count = store.signal('count', 1)
		const alias = store.alias('count', count)
		expect(alias).toBe(count)
		expect(store.get<number>('count').value).toBe(1)
		alias.value = 3
		expect(count.value).toBe(3)
	})

	it('fails when aliasing a path that already maps to a different entry', () => {
		const store = new SignalStore()
		store.signal('count', 1)
		store.signal('other', 2)
		expect(() => store.alias('count', store.get('other'))).toThrow(/already registered/)
	})
})
