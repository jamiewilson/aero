import { describe, expect, it } from 'vitest'
import { Aero } from '../index'
import { mountStateBindingsForRoute } from '../state-bindings-prod'

describe('mountStateBindingsForRoute', () => {
	it('invokes resolved mountStateBindings and returns cleanup', async () => {
		const aero = new Aero()
		const target = {} as HTMLElement
		let cleaned = false
		const result = await mountStateBindingsForRoute(
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
		expect(result.hasStateBindings).toBe(true)
		result.cleanup()
		expect(cleaned).toBe(true)
	})

	it('returns no-op cleanup when route has no reactive module', async () => {
		const result = await mountStateBindingsForRoute(
			new Aero(),
			'/about',
			{} as HTMLElement,
			async () => null
		)
		expect(result.hasStateBindings).toBe(false)
		expect(result.cleanup()).toBeUndefined()
	})
})
