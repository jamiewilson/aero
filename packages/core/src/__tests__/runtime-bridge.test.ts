import { describe, expect, it } from 'vitest'
import { createReactivityRuntime } from '../reactivity'
import { createHypermediaRuntime } from '../hypermedia'

describe('@aero-js/core runtime bridges', () => {
	it('re-exports reactivity placeholder runtime', () => {
		const runtime = createReactivityRuntime()
		expect(runtime.kind).toBe('reactivity-runtime')
		expect(runtime.store.snapshot()).toEqual({})
	})

	it('re-exports hypermedia placeholder runtime', () => {
		expect(createHypermediaRuntime()).toEqual({ kind: 'hypermedia-runtime' })
	})
})
