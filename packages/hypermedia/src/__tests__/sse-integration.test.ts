import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHypermediaRuntime } from '../runtime'
import { formatSseEvent, AERO_SSE_PATCH_ELEMENTS, AERO_SSE_PATCH_SIGNALS } from '../sse'

beforeEach(() => {
	vi.restoreAllMocks()
})

describe('SSE action integration', () => {
	it('applies aero-patch-elements from an event-stream response', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="live">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const payload = formatSseEvent(
			AERO_SSE_PATCH_ELEMENTS,
			'{"target":"#live","html":"<span>live</span>","swap":"innerHTML"}'
		)
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(payload, {
				status: 200,
				headers: { 'Content-Type': 'text/event-stream' },
			})
		)

		await runtime.executeAction(
			{ method: 'GET', url: '/api/sse', target: '#live', swap: 'innerHTML' },
			btn
		)

		expect(document.querySelector('#live')?.innerHTML).toBe('<span>live</span>')
	})

	it('merges aero-patch-signals when reactivity is enabled', async () => {
		document.body.innerHTML = '<button id="btn">go</button>'
		const btn = document.querySelector('#btn')!
		const merge = vi.fn()
		const runtime = createHypermediaRuntime({
			reactivity: true,
			store: { get: () => ({ value: 0 }), merge },
		})
		const payload = formatSseEvent(AERO_SSE_PATCH_SIGNALS, '{"count":4}')
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(payload, {
				status: 200,
				headers: { 'Content-Type': 'text/event-stream' },
			})
		)

		await runtime.executeAction({ method: 'GET', url: '/api/sse', swap: 'none' }, btn)
		expect(merge).toHaveBeenCalledWith({ count: 4 })
	})

	it('ignores datastar SSE events', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="live">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const payload = formatSseEvent(
			'datastar-patch-elements',
			'{"target":"#live","html":"<span>no</span>"}'
		)
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(payload, {
				status: 200,
				headers: { 'Content-Type': 'text/event-stream' },
			})
		)

		await runtime.executeAction({ method: 'GET', url: '/api/sse' }, btn)
		expect(document.querySelector('#live')?.textContent).toBe('old')
	})
})
