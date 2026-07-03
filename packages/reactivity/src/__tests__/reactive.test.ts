import { describe, expect, it, vi } from 'vitest'
import { Effect } from '../effect'
import { reviveStateValue } from '../hydration'
import { isReactive, makeReactive, toRaw } from '../reactive'
import { Signal } from '../signal'
import { createStateScope } from '../state-scope'
import { SignalStore } from '../store'

describe('Signal.notify', () => {
	it('schedules effects without changing value', () => {
		const signal = new Signal({ count: 0 })
		let runs = 0
		new Effect(() => {
			signal.value
			runs++
		})
		expect(runs).toBe(1)
		signal.notify()
		expect(runs).toBe(2)
	})

	it('notifies subscribers without changing value', () => {
		const signal = new Signal(1)
		const seen: number[] = []
		signal.subscribe(v => seen.push(v))
		signal.notify()
		expect(seen).toEqual([1])
	})
})

describe('makeReactive', () => {
	it('notifies on nested object set and delete', () => {
		const notify = vi.fn()
		const obj = makeReactive({ email: '' } as Record<string, string>, notify)
		obj.email = 'a@b.c'
		expect(notify).toHaveBeenCalledTimes(1)
		delete obj.email
		expect(notify).toHaveBeenCalledTimes(2)
	})

	it('skips notify on same-value object assign', () => {
		const notify = vi.fn()
		const obj = makeReactive({ email: 'x' }, notify)
		obj.email = 'x'
		expect(notify).not.toHaveBeenCalled()
	})

	it('notifies on array index assign and mutating methods', () => {
		const notify = vi.fn()
		const arr = makeReactive([1, 2, 3], notify)
		arr[0] = 9
		expect(notify).toHaveBeenCalledTimes(1)
		arr.push(4)
		expect(notify).toHaveBeenCalledTimes(2)
		arr.splice(1, 1)
		expect(notify).toHaveBeenCalledTimes(3)
		arr.pop()
		expect(notify).toHaveBeenCalledTimes(4)
	})

	it('notifies on Map set, delete, and clear', () => {
		const notify = vi.fn()
		const map = makeReactive(new Map<number, string>([[1, 'one']]), notify)
		map.set(2, 'two')
		expect(notify).toHaveBeenCalledTimes(1)
		map.delete(1)
		expect(notify).toHaveBeenCalledTimes(2)
		map.clear()
		expect(notify).toHaveBeenCalledTimes(3)
	})

	it('notifies on Set add, delete, and clear', () => {
		const notify = vi.fn()
		const set = makeReactive(new Set([1, 2]), notify)
		set.add(3)
		expect(notify).toHaveBeenCalledTimes(1)
		set.delete(1)
		expect(notify).toHaveBeenCalledTimes(2)
		set.clear()
		expect(notify).toHaveBeenCalledTimes(3)
	})

	it('wraps nested collections inside objects', () => {
		const notify = vi.fn()
		const state = makeReactive({ items: [1] }, notify)
		state.items.push(2)
		expect(notify).toHaveBeenCalledTimes(1)
	})

	it('toRaw unwraps reactive proxies for JSON', () => {
		const obj = makeReactive({ email: 'a@b.c' }, () => {})
		expect(isReactive(obj)).toBe(true)
		expect(JSON.stringify(toRaw(obj))).toBe('{"email":"a@b.c"}')
	})

	it('does not double-wrap reactive values', () => {
		const notify = vi.fn()
		const first = makeReactive({ x: 1 }, notify)
		const second = makeReactive(first, notify)
		expect(second).toBe(first)
	})

	it('reads Set and Map size through reactive proxy', () => {
		const set = makeReactive(new Set([1, 2, 3]), () => {})
		expect(set.size).toBe(3)
		const map = makeReactive(new Map([[1, 'one'], [2, 'two']]), () => {})
		expect(map.size).toBe(2)
	})
})

describe('mergeBindings', () => {
	it('preserves top-level object shape without flattening', () => {
		const store = new SignalStore()
		store.mergeBindings({ formModel: { email: 'a@b.c' } })
		expect(store.get<{ email: string }>('formModel').value).toEqual({ email: 'a@b.c' })
		expect(() => store.get('formModel.email')).toThrow(/Missing signal path/)
	})
})

describe('reviveStateValue', () => {
	it('revives Map and Set hydration payloads', () => {
		const map = reviveStateValue({ __aero: 'Map', entries: [[1, 'one']] }) as Map<number, string>
		expect(map).toBeInstanceOf(Map)
		expect(map.get(1)).toBe('one')
		const set = reviveStateValue({ __aero: 'Set', values: [1, 2, 3] }) as Set<number>
		expect(set).toBeInstanceOf(Set)
		expect([...set]).toEqual([1, 2, 3])
	})
})

describe('createStateScope reactive wiring', () => {
	it('notifies effects when nested state mutates in place', () => {
		const store = new SignalStore()
		const scope = createStateScope({
			store,
			bindings: [{ name: 'formModel', derived: false, init: () => ({ email: '' }), dependencies: [] }],
			functionSources: [],
		})
		let email = ''
		new Effect(() => {
			email = (scope.formModel as { email: string }).email
		})
		;(scope.formModel as { email: string }).email = 'x@y.z'
		expect(email).toBe('x@y.z')
	})

	it('wraps pre-hydrated store values from mergeBindings', () => {
		const store = new SignalStore()
		store.mergeBindings({ formModel: { email: '' } })
		const scope = createStateScope({
			store,
			bindings: [{ name: 'formModel', derived: false, init: () => ({ email: '' }), dependencies: [] }],
			functionSources: [],
		})
		let email = ''
		new Effect(() => {
			email = (scope.formModel as { email: string }).email
		})
		;(scope.formModel as { email: string }).email = 'hydrated@x.y'
		expect(email).toBe('hydrated@x.y')
	})
})
