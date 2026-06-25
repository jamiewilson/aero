import { describe, expect, it, vi } from 'vitest'
import { composeHypermediaReactivityAdopt } from '../client-mount'

describe('composeHypermediaReactivityAdopt', () => {
	it('chains hypermedia and reactivity adopt on runtime fragments', () => {
		const hypermediaAdopt = vi.fn()
		const reactivityAdopt = vi.fn(() => () => {})
		;(globalThis as Record<string, unknown>).__AERO_HYPERMEDIA_RUNTIME__ = { adopt: hypermediaAdopt }
		;(globalThis as Record<string, unknown>).__AERO_REACTIVITY_RUNTIME__ = {
			store: {},
			adopt: reactivityAdopt,
		}

		composeHypermediaReactivityAdopt()
		const runtime = (globalThis as Record<string, unknown>).__AERO_HYPERMEDIA_RUNTIME__ as {
			adopt: (container: ParentNode) => void
		}
		const container = {} as ParentNode
		runtime.adopt(container)

		expect(hypermediaAdopt).toHaveBeenCalledWith(container, undefined)
		expect(reactivityAdopt).toHaveBeenCalledWith(container, {})
	})
})
