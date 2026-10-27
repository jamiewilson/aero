import { describe, expect, it } from 'vite-plus/test'
import { createReactivityRuntime } from '../index'

describe('@aero-js/reactivity scaffold', () => {
	it('exposes placeholder runtime factory', () => {
		const runtime = createReactivityRuntime()
		expect(runtime.kind).toBe('reactivity-runtime')
		expect(runtime.store.snapshot()).toEqual({})
	})
})
