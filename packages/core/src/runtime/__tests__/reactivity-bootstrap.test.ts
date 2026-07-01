import { describe, expect, it } from 'vitest'
import {
	REACTIVITY_RUNTIME_GLOBAL_KEY,
	bootstrapReactivityRuntime,
	readBootstrappedReactivityRuntime,
	resetBootstrappedReactivityRuntime,
} from '../reactivity-bootstrap'

describe('bootstrapReactivityRuntime', () => {
	it('creates runtime once from aero/state payload', () => {
		const globalObj = globalThis as unknown as Record<string, unknown>
		delete globalObj[REACTIVITY_RUNTIME_GLOBAL_KEY]
		const prevDocument = globalObj.document
		globalObj.document = {
			querySelector: () => ({ textContent: '{"count":4}' }),
		}

		try {
			const first = bootstrapReactivityRuntime()
			const second = bootstrapReactivityRuntime()
			expect(first).toBe(second)
			expect(readBootstrappedReactivityRuntime()).toBe(first)
			expect((first as { kind?: string }).kind).toBe('reactivity-runtime')
			expect(
				(first as { store?: { snapshot(): Record<string, unknown> } }).store?.snapshot()
			).toEqual({ count: 4 })
		} finally {
			if (prevDocument === undefined) delete globalObj.document
			else globalObj.document = prevDocument
			delete globalObj[REACTIVITY_RUNTIME_GLOBAL_KEY]
		}
	})

	it('resetBootstrappedReactivityRuntime clears global so next bootstrap re-hydrates', () => {
		const globalObj = globalThis as unknown as Record<string, unknown>
		delete globalObj[REACTIVITY_RUNTIME_GLOBAL_KEY]
		const prevDocument = globalObj.document
		globalObj.document = {
			querySelector: () => ({ textContent: '{"count":1}' }),
		}

		try {
			const first = bootstrapReactivityRuntime()
			resetBootstrappedReactivityRuntime()
			expect(readBootstrappedReactivityRuntime()).toBeNull()
			globalObj.document = {
				querySelector: () => ({ textContent: '{"count":9}' }),
			}
			const second = bootstrapReactivityRuntime()
			expect(second).not.toBe(first)
			expect(second.store.snapshot()).toEqual({ count: 9 })
		} finally {
			if (prevDocument === undefined) delete globalObj.document
			else globalObj.document = prevDocument
			delete globalObj[REACTIVITY_RUNTIME_GLOBAL_KEY]
		}
	})
})
