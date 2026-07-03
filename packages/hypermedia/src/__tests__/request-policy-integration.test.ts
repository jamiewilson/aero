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

describe('request policy integration', () => {
	it('retries network errors up to three times with retry auto', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValueOnce(new Response('<span>ok</span>', { status: 200 }))

		await runtime.executeAction(
			{ method: 'GET', url: '/api/x', target: '#result', swap: 'innerHTML', retry: 'auto' },
			btn
		)

		expect(fetchMock).toHaveBeenCalledTimes(3)
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>ok</span>')
	})

	it('does not retry 4xx responses', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<span>not found</span>', { status: 404 })
		)

		await runtime.executeAction(
			{ method: 'GET', url: '/api/x', target: '#result', swap: 'innerHTML', retry: 'error' },
			btn
		)

		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>not found</span>')
	})

	it('retries 5xx only for retry error', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response('err', { status: 500 }))
			.mockResolvedValueOnce(new Response('<span>ok</span>', { status: 200 }))

		await runtime.executeAction(
			{ method: 'GET', url: '/api/x', target: '#result', swap: 'innerHTML', retry: 'error' },
			btn
		)

		expect(fetchMock).toHaveBeenCalledTimes(2)
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>ok</span>')
	})

	it('aborts prior in-flight request from same trigger with cancel auto', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const first = deferredResponse()
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockReturnValueOnce(first.promise)
			.mockResolvedValueOnce(new Response('<span>newest</span>', { status: 200 }))
		const errors: string[] = []
		btn.addEventListener('error', event => {
			errors.push(((event as CustomEvent).detail.error as Error).message)
		})

		const firstRequest = runtime.executeAction(
			{ method: 'GET', url: '/slow', target: '#result', swap: 'innerHTML' },
			btn
		)
		const secondRequest = runtime.executeAction(
			{ method: 'GET', url: '/fast', target: '#result', swap: 'innerHTML' },
			btn
		)

		await secondRequest
		first.resolve(new Response('<span>stale</span>', { status: 200 }))
		await firstRequest

		expect(fetchMock).toHaveBeenCalledTimes(2)
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>newest</span>')
		expect(errors).toEqual([])
	})

	it('swallows superseded abort when fetch rejects with signal.reason symbol', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="host">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const fetchMock = vi.spyOn(globalThis, 'fetch')
		fetchMock.mockImplementationOnce((_url, init) => {
			return new Promise((_resolve, reject) => {
				const signal = init?.signal
				if (signal?.aborted) {
					reject(signal.reason)
					return
				}
				signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
			})
		})
		fetchMock.mockResolvedValueOnce(new Response('<div id="host">new</div>', { status: 200 }))

		const firstRequest = runtime.executeAction(
			{ method: 'GET', url: '/slow', target: '#host', swap: 'outerHTML' },
			btn
		)
		const secondRequest = runtime.executeAction(
			{ method: 'GET', url: '/fast', target: '#host', swap: 'outerHTML' },
			btn
		)

		await expect(firstRequest).resolves.toEqual(expect.objectContaining({ ok: false, status: 0 }))
		await secondRequest
		expect(document.querySelector('#host')?.outerHTML).toContain('new')
	})

	it('discards stale completed responses when latest-wins', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const first = deferredResponse()
		const second = deferredResponse()
		vi.spyOn(globalThis, 'fetch')
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise)

		const firstRequest = runtime.executeAction(
			{ method: 'GET', url: '/a', target: '#result', swap: 'innerHTML', cancel: 'disabled' },
			btn
		)
		const secondRequest = runtime.executeAction(
			{ method: 'GET', url: '/b', target: '#result', swap: 'innerHTML', cancel: 'disabled' },
			btn
		)

		second.resolve(new Response('<span>second</span>', { status: 200 }))
		await secondRequest
		first.resolve(new Response('<span>first</span>', { status: 200 }))
		await firstRequest

		expect(document.querySelector('#result')?.innerHTML).toBe('<span>second</span>')
	})

	it('applies select before primary swap', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<div class="wrap"><section id="part">picked</section></div>', { status: 200 })
		)

		await runtime.executeAction(
			{
				method: 'GET',
				url: '/api/x',
				target: '#result',
				swap: 'innerHTML',
				select: '#part',
			},
			btn
		)

		expect(document.querySelector('#result')?.innerHTML).toBe(
			'<section id="part">picked</section>'
		)
	})

	it('skips primary swap when select finds no match', async () => {
		document.body.innerHTML = '<button id="btn">go</button><div id="result">old</div>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('<div>full</div>', { status: 200 })
		)

		await runtime.executeAction(
			{
				method: 'GET',
				url: '/api/x',
				target: '#result',
				swap: 'innerHTML',
				select: '#missing',
			},
			btn
		)

		expect(document.querySelector('#result')?.innerHTML).toBe('old')
	})

	it('composes external AbortSignal with cancel auto', async () => {
		document.body.innerHTML = '<button id="btn">go</button>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const external = new AbortController()
		vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
			return new Promise((_resolve, reject) => {
				const signal = init?.signal
				if (signal?.aborted) {
					reject(new DOMException('Aborted', 'AbortError'))
					return
				}
				signal?.addEventListener('abort', () => {
					reject(new DOMException('Aborted', 'AbortError'))
				})
			})
		})
		const errors: string[] = []
		btn.addEventListener('error', event => {
			errors.push(((event as CustomEvent).detail.error as Error).message)
		})

		const request = runtime.executeAction(
			{ method: 'GET', url: '/api/x', swap: 'none', signal: external.signal },
			btn
		)
		external.abort()
		await expect(request).rejects.toBeDefined()
		expect(errors.length).toBeGreaterThan(0)
	})
})
