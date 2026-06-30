/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { mountStateBindings } from '../mount'
import { createHypermediaRuntime, GET } from '../../../hypermedia/src/index'
import { SignalStore } from '../store'

describe('wrapped GET hypermedia', () => {
	it('routes GET inside state handlers through hypermedia runtime', async () => {
		const button = document.createElement('button')
		const target = document.createElement('div')
		target.id = 'hypermedia-result'
		target.textContent = 'Waiting...'
		document.body.innerHTML = ''
		document.body.append(button, target)

		const runtime = createHypermediaRuntime()
		const executeActionSpy = vi.spyOn(runtime, 'executeAction')
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<p>fragment</p>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		)

		const store = new SignalStore()
		store.merge({ isLoading: false })

		const cleanup = mountStateBindings({
			allowLegacyRuntimeCompile: true,
			root: document.body,
			store,
			bindings: [
				{ name: 'isLoading', derived: false, initExpr: 'false', dependencies: [] },
				{
					name: 'loadFragment',
					derived: false,
					initExpr: "async () => { await GET('/api/hypermedia-demo', { target: '#hypermedia-result' }) }",
					dependencies: [],
				},
			],
			functionSources: [],
			scopeConstants: { GET },
			textBinds: [],
			eventBinds: [{ selector: 'button', event: 'click', handlerExpr: 'loadFragment()' }],
			hypermediaRuntime: runtime,
		})

		button.click()
		await vi.waitFor(() => {
			expect(target.innerHTML).toBe('<p>fragment</p>')
		})

		expect(executeActionSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				url: '/api/hypermedia-demo',
				target: '#hypermedia-result',
			}),
			button
		)
		cleanup()
	})
})
