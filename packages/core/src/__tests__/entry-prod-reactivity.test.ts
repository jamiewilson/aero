import { describe, expect, it, vi } from 'vitest'
import aero from '../entry-prod'
import { REACTIVITY_RUNTIME_GLOBAL_KEY } from '../runtime/reactivity-bootstrap'

vi.mock('virtual:aero/state-bindings-registry.ts', () => ({
	resolveStateBindingsModule: vi.fn(async () => null),
}))

describe('entry-prod reactivity bootstrap', () => {
	it('bootstraps from aero/state payload and exposes runtime accessor', async () => {
		const globalObj = globalThis as unknown as Record<string, unknown>
		const prevDocument = globalObj.document
		delete globalObj[REACTIVITY_RUNTIME_GLOBAL_KEY]
		globalObj.document = {
			querySelector: (selector: string) =>
				selector === 'script[type="aero/state"]' ? { textContent: '{"count":5}' } : null,
		}
		const target = {} as HTMLElement
		try {
			await aero.mount({ target })
			const runtime = (
				aero as unknown as {
					getReactivityRuntime: () => { store: { snapshot(): Record<string, unknown> } } | null
				}
			).getReactivityRuntime()
			expect(runtime?.store.snapshot()).toEqual({ count: 5 })
		} finally {
			if (prevDocument === undefined) delete globalObj.document
			else globalObj.document = prevDocument
			delete globalObj[REACTIVITY_RUNTIME_GLOBAL_KEY]
		}
	})

	it('destroys prior state bindings before remounting', async () => {
		const target = {} as HTMLElement
		const cleanupCalls: number[] = []
		const { resolveStateBindingsModule } = await import('virtual:aero/state-bindings-registry.ts')
		vi.mocked(resolveStateBindingsModule).mockImplementation(async () => {
			return (_root, _aero) => {
				const id = cleanupCalls.length + 1
				return () => {
					cleanupCalls.push(id)
				}
			}
		})

		try {
			await aero.mount({ target })
			expect(cleanupCalls).toEqual([])
			await aero.mount({ target })
			expect(cleanupCalls).toEqual([1])
		} finally {
			vi.mocked(resolveStateBindingsModule).mockResolvedValue(null)
		}
	})
})
