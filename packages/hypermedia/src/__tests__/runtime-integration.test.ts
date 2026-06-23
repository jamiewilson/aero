import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHypermediaRuntime } from '../runtime'

function deferredResponse() {
	let resolve!: (value: Response) => void
	const promise = new Promise<Response>(r => {
		resolve = r
	})
	return { promise, resolve }
}

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

	it('dispatches lifecycle events on trigger and explicit target in order', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const target = document.querySelector('#result')!
		const runtime = createHypermediaRuntime()
		const calls: string[] = []
		for (const eventName of ['request', 'response', 'swap', 'settle'] as const) {
			btn.addEventListener(eventName, event => {
				calls.push(`trigger:${event.type}:${(event.currentTarget as Element).id}`)
			})
			target.addEventListener(eventName, event => {
				calls.push(`target:${event.type}:${(event.currentTarget as Element).id}:${target.innerHTML}`)
			})
		}
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<span>new</span>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		)

		await runtime.executeAction(
			{ method: 'GET', url: '/api/x', target: '#result', swap: 'innerHTML' },
			btn
		)

		expect(calls).toEqual([
			'trigger:request:btn',
			'target:request:result:old',
			'trigger:response:btn',
			'target:response:result:old',
			'trigger:swap:btn',
			'target:swap:result:<span>new</span>',
			'trigger:settle:btn',
			'target:settle:result:<span>new</span>',
		])
	})

	it('dispatches network errors on trigger and explicit target', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const target = document.querySelector('#result')!
		const runtime = createHypermediaRuntime()
		const calls: string[] = []
		btn.addEventListener('error', event => {
			calls.push(`trigger:${event.type}:${((event as CustomEvent).detail.error as Error).message}`)
		})
		target.addEventListener('error', event => {
			calls.push(`target:${event.type}:${((event as CustomEvent).detail.error as Error).message}`)
		})
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

		await expect(
			runtime.executeAction({ method: 'GET', url: '/api/x', target: '#result' }, btn)
		).rejects.toThrow('offline')

		expect(calls).toEqual(['trigger:error:offline', 'target:error:offline'])
	})

	it('keeps a shared state signal busy until all matching requests complete', async () => {
		document.body.innerHTML = '<button id="a">a</button><button id="b">b</button>'
		const first = deferredResponse()
		const second = deferredResponse()
		vi.spyOn(globalThis, 'fetch')
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise)
		const runtime = createHypermediaRuntime()
		const state = { value: false }

		const a = document.querySelector('#a')!
		const b = document.querySelector('#b')!
		const firstRequest = runtime.executeAction({ method: 'POST', url: '/a', state, swap: 'none' }, a)
		const secondRequest = runtime.executeAction({ method: 'POST', url: '/b', state, swap: 'none' }, b)

		expect(state.value).toBe(true)
		first.resolve(new Response('', { status: 200 }))
		await firstRequest
		expect(state.value).toBe(true)
		second.resolve(new Response('', { status: 200 }))
		await secondRequest
		expect(state.value).toBe(false)
	})

	it('uses per-action state before element busy binding', async () => {
		document.body.innerHTML = '<button id="btn">go</button>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const elementBusy = { value: false }
		const actionState = { value: false }
		runtime.registerBusyBinding(btn, 'elementBusy', elementBusy)
		const response = deferredResponse()
		vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(response.promise)

		const request = runtime.executeAction(
			{ method: 'POST', url: '/save', state: actionState, swap: 'none' },
			btn
		)

		expect(actionState.value).toBe(true)
		expect(elementBusy.value).toBe(false)
		response.resolve(new Response('', { status: 200 }))
		await request
		expect(actionState.value).toBe(false)
		expect(elementBusy.value).toBe(false)
	})

	it('auto-disables mutating trigger elements by default', async () => {
		document.body.innerHTML = '<button id="btn">go</button>'
		const btn = document.querySelector('#btn') as HTMLButtonElement
		const runtime = createHypermediaRuntime()
		const response = deferredResponse()
		vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(response.promise)

		const request = runtime.executeAction({ method: 'POST', url: '/save', swap: 'none' }, btn)

		expect(btn.disabled).toBe(true)
		response.resolve(new Response('', { status: 200 }))
		await request
		expect(btn.disabled).toBe(false)
	})

	it('does not auto-disable GET or explicit opt-out actions', async () => {
		document.body.innerHTML = '<button id="get">get</button><button id="post">post</button>'
		const get = document.querySelector('#get') as HTMLButtonElement
		const post = document.querySelector('#post') as HTMLButtonElement
		const runtime = createHypermediaRuntime()
		vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
			Promise.resolve(new Response('', { status: 200 }))
		)

		await runtime.executeAction({ method: 'GET', url: '/read', swap: 'none' }, get)
		await runtime.executeAction({ method: 'POST', url: '/write', autoDisable: false, swap: 'none' }, post)

		expect(get.disabled).toBe(false)
		expect(post.disabled).toBe(false)
	})

	it('applies lifecycle classes to trigger and explicit target during each phase', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const target = document.querySelector('#result')!
		const runtime = createHypermediaRuntime()
		const calls: string[] = []

		btn.addEventListener('request', () => {
			calls.push(`request:${btn.className}:${target.className}`)
		})
		target.addEventListener('response', () => {
			calls.push(`response:${btn.className}:${target.className}`)
		})
		target.addEventListener('swap', () => {
			calls.push(`swap:${btn.className}:${target.className}`)
		})
		target.addEventListener('settle', () => {
			calls.push(`settle:${btn.className}:${target.className}`)
		})

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<span>new</span>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		)

		await runtime.executeAction(
			{ method: 'GET', url: '/api/x', target: '#result', swap: 'innerHTML' },
			btn
		)

		expect(calls).toEqual([
			'request:aero-loading:aero-loading',
			'response::',
			'swap:aero-swapping:aero-swapping',
			'settle:aero-settling:aero-settling',
		])
		expect(btn.className).toBe('')
		expect(target.className).toBe('')
	})

	it('mirrors lifecycle busy state to aria-busy when requested', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result" aria-busy="false">old</div>'
		const btn = document.querySelector('#btn')!
		const target = document.querySelector('#result')!
		const runtime = createHypermediaRuntime()
		const calls: string[] = []

		target.addEventListener('request', () => {
			calls.push(`request:${btn.getAttribute('aria-busy')}:${target.getAttribute('aria-busy')}`)
		})
		target.addEventListener('settle', () => {
			calls.push(`settle:${btn.getAttribute('aria-busy')}:${target.getAttribute('aria-busy')}`)
		})

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<span>new</span>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		)

		await runtime.executeAction(
			{ method: 'GET', url: '/api/x', target: '#result', swap: 'innerHTML', ariaBusy: true },
			btn
		)

		expect(calls).toEqual(['request:true:true', 'settle:true:true'])
		expect(btn.hasAttribute('aria-busy')).toBe(false)
		expect(target.getAttribute('aria-busy')).toBe('false')
	})

	it('moves focus to the swap target when the focused descendant is removed without changing scroll', async () => {
		document.body.innerHTML = '<div id="result"><button id="focused">focus me</button></div>'
		const target = document.querySelector('#result') as HTMLElement
		const focused = document.querySelector('#focused') as HTMLButtonElement
		const runtime = createHypermediaRuntime()
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
		Object.defineProperty(window, 'scrollX', { configurable: true, value: 11 })
		Object.defineProperty(window, 'scrollY', { configurable: true, value: 27 })
		focused.focus()

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<span>new</span>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		)

		await runtime.executeAction(
			{ method: 'GET', url: '/api/x', target: '#result', swap: 'innerHTML' },
			focused
		)

		expect(document.activeElement).toBe(target)
		expect(target.getAttribute('tabindex')).toBe('-1')
		expect(window.scrollX).toBe(11)
		expect(window.scrollY).toBe(27)
		expect(scrollTo).not.toHaveBeenCalled()
	})
})
