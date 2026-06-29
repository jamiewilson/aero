import { describe, expect, it, vi } from 'vitest'
import { composeHypermediaReactivityProcess } from '../client-mount'

describe('composeHypermediaReactivityProcess', () => {
	it('chains hypermedia and reactivity process on runtime fragments', () => {
		const hypermediaProcess = vi.fn()
		const reactivityProcess = vi.fn(() => () => {})
		;(globalThis as Record<string, unknown>).__AERO_HYPERMEDIA_RUNTIME__ = { process: hypermediaProcess }
		;(globalThis as Record<string, unknown>).__AERO_REACTIVITY_RUNTIME__ = {
			store: {},
			process: reactivityProcess,
		}

		composeHypermediaReactivityProcess()
		const runtime = (globalThis as Record<string, unknown>).__AERO_HYPERMEDIA_RUNTIME__ as {
			process: (element: ParentNode) => void
		}
		const element = {} as ParentNode
		runtime.process(element)

		expect(hypermediaProcess).toHaveBeenCalledWith(element, undefined)
		expect(reactivityProcess).toHaveBeenCalledWith(element, {})
	})
})
