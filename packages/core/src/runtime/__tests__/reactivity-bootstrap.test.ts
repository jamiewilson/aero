import { describe, expect, it } from 'vitest'
import {
	REACTIVITY_RUNTIME_GLOBAL_KEY,
	bootstrapReactivityRuntime,
	readBootstrappedReactivityRuntime,
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
		} finally {
			if (prevDocument === undefined) delete globalObj.document
			else globalObj.document = prevDocument
			delete globalObj[REACTIVITY_RUNTIME_GLOBAL_KEY]
		}
	})
})
