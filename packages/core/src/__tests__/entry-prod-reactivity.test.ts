import { describe, expect, it } from 'vitest'
import aero from '../entry-prod'
import { REACTIVITY_RUNTIME_GLOBAL_KEY } from '../runtime/reactivity-bootstrap'

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
		const originalMountStateBindingsForPath = (
			aero as unknown as { mountStateBindingsForPath: (pathname: string, root: HTMLElement) => () => void }
		).mountStateBindingsForPath
		let bindingId = 0
		;(aero as unknown as { mountStateBindingsForPath: (pathname: string, root: HTMLElement) => () => void }).mountStateBindingsForPath =
			(_pathname: string, _root: HTMLElement) => {
				const id = ++bindingId
				return () => cleanupCalls.push(id)
			}

		try {
			await aero.mount({ target })
			expect(cleanupCalls).toEqual([])
			await aero.mount({ target })
			expect(cleanupCalls).toEqual([1])
		} finally {
			;(aero as unknown as {
				mountStateBindingsForPath: (pathname: string, root: HTMLElement) => () => void
			}).mountStateBindingsForPath = originalMountStateBindingsForPath
		}
	})
})
