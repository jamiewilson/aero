/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { mountStateBindings } from '@aero-js/reactivity'
import { createHypermediaRuntime } from '@aero-js/hypermedia'
import { SignalStore } from '@aero-js/reactivity'

describe('hypermedia client integration', () => {
	it('executes wrapped GET through hypermedia runtime on click', async () => {
		const button = document.createElement('button')
		button.setAttribute('data-aero-event', '0')
		const target = document.createElement('div')
		target.id = 'result'
		document.body.innerHTML = ''
		document.body.append(button, target)

		const runtime = createHypermediaRuntime()
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<p>ok</p>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		)

		const store = new SignalStore()
		const cleanup = mountStateBindings({
			allowLegacyRuntimeCompile: true,
			root: document.body,
			store,
			bindings: [],
			functionSources: [],
			textBinds: [],
			eventBinds: [
				{
					selector: '[data-aero-event="0"]',
					event: 'click',
					handlerExpr: "GET('/api/x', { target: '#result' })",
					modifiers: [],
				},
			],
			hypermediaRuntime: runtime,
		})

		button.click()
		await vi.waitFor(() => {
			expect(target.innerHTML).toBe('<p>ok</p>')
		})
		cleanup()
	})
})
