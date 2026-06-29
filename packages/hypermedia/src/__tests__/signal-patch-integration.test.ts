import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHypermediaRuntime } from '../runtime'

beforeEach(() => {
	vi.restoreAllMocks()
})

describe('signal patch integration', () => {
	it('merges application/json into the store when reactivity is enabled', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">0</div>'
		const btn = document.querySelector('#btn')!
		const merge = vi.fn()
		const runtime = createHypermediaRuntime({
			reactivity: true,
			store: {
				get: () => ({ value: 0 }),
				merge,
			},
		})
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('{"count":3}', {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		)

		await runtime.executeAction(
			{ method: 'GET', url: '/api/state', target: '#result', swap: 'innerHTML' },
			btn
		)

		expect(merge).toHaveBeenCalledWith({ count: 3 })
		expect(document.querySelector('#result')?.textContent).toBe('0')
	})

	it('skips signal merge when reactivity is disabled', async () => {
		const merge = vi.fn()
		const runtime = createHypermediaRuntime({
			reactivity: false,
			store: { get: () => ({ value: 0 }), merge },
		})
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('{"count":3}', {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		)

		await runtime.executeAction({ method: 'GET', url: '/api/state', swap: 'none' })
		expect(merge).not.toHaveBeenCalled()
	})
})
