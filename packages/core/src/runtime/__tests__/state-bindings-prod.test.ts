import { describe, expect, it } from 'vitest'
import { Aero } from '../index'
import { mountStateBindingsForRoute } from '../state-bindings-prod'

describe('mountStateBindingsForRoute', () => {
	it('invokes resolved mountStateBindings and returns cleanup', async () => {
		const aero = new Aero()
		const target = {} as HTMLElement
		let cleaned = false
		const cleanup = await mountStateBindingsForRoute(
			aero,
			'/demos/counter',
			target,
			async pathname => {
				expect(pathname).toBe('/demos/counter')
				return (_root, runtime) => {
					expect(runtime).toBe(aero)
					return () => {
						cleaned = true
					}
				}
			}
		)
		cleanup()
		expect(cleaned).toBe(true)
	})

	it('returns no-op cleanup when route has no reactive module', async () => {
		const cleanup = await mountStateBindingsForRoute(
			new Aero(),
			'/about',
			{} as HTMLElement,
			async () => null
		)
		expect(cleanup()).toBeUndefined()
	})
})
