import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHypermediaRuntime } from '../runtime'

beforeEach(() => {
	vi.restoreAllMocks()
})

describe('createHypermediaRuntime integration', () => {
	it('swaps into trigger element by default when target omitted', async () => {
		document.body.innerHTML = '<button id="btn">old</button>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<span>new</span>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		)

		await runtime.executeAction({ method: 'GET', url: '/api/x' }, btn as HTMLButtonElement)
		expect(btn.innerHTML).toBe('<span>new</span>')
	})

	it('applies Aero-Push-Url response header', async () => {
		document.body.innerHTML = '<button id="btn">x</button>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const pushState = vi.spyOn(history, 'pushState').mockImplementation(() => {})
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('', {
				status: 200,
				headers: { 'Aero-Push-Url': '/new-path' },
			})
		)

		await runtime.executeAction({ method: 'GET', url: '/api/x', swap: 'none' }, btn as HTMLButtonElement)
		expect(pushState).toHaveBeenCalledWith({}, '', '/new-path')
	})

	it('syncs anchor href before request for dynamic fallback', async () => {
		document.body.innerHTML = '<a id="link">go</a>'
		const link = document.querySelector('#link') as HTMLAnchorElement
		const runtime = createHypermediaRuntime()
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))

		await runtime.executeAction({ method: 'GET', url: '/dynamic/path' }, link)
		expect(link.href).toContain('/dynamic/path')
	})
})
