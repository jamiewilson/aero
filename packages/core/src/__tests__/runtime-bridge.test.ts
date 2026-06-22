import { describe, expect, it } from 'vitest'
import { createReactivityRuntime } from '../reactivity'
import { DELETE, GET, PATCH, POST, PUT, createHypermediaRuntime } from '../hypermedia'

describe('@aero-js/core runtime bridges', () => {
	it('re-exports reactivity placeholder runtime', () => {
		const runtime = createReactivityRuntime()
		expect(runtime.kind).toBe('reactivity-runtime')
		expect(runtime.store.snapshot()).toEqual({})
	})

	it('re-exports hypermedia runtime', () => {
		const runtime = createHypermediaRuntime()
		expect(runtime.kind).toBe('hypermedia-runtime')
	})

	it('re-exports hypermedia action functions', () => {
		expect(typeof GET).toBe('function')
		expect(typeof POST).toBe('function')
		expect(typeof PUT).toBe('function')
		expect(typeof PATCH).toBe('function')
		expect(typeof DELETE).toBe('function')
	})
})
