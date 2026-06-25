import { describe, expect, it } from 'vitest'
import { createReactivityRuntime } from '../index'

describe('createReactivityRuntime', () => {
	it('hydrates store from provided initial state', () => {
		const runtime = createReactivityRuntime({ initialState: { count: 2, user: { name: 'Ada' } } })
		expect(runtime.store.snapshot()).toEqual({ count: 2, user: { name: 'Ada' } })
	})

	it('hydrates store from aero/state payload when initial state absent', () => {
		const root = { querySelector: () => ({ textContent: '{"count":3}' }) }
		const runtime = createReactivityRuntime({ hydrationRoot: root })
		expect(runtime.store.snapshot()).toEqual({ count: 3 })
	})
})
