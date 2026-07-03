import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHypermediaRuntime } from '../runtime'

beforeEach(() => {
	vi.restoreAllMocks()
})

describe('createHypermediaRuntime', () => {
	it('returns runtime with correct kind', () => {
		const runtime = createHypermediaRuntime()
		expect(runtime.kind).toBe('hypermedia-runtime')
	})

	it('swapElement performs swap on resolved target', () => {
		document.body.innerHTML = '<div id="result">old</div>'
		const runtime = createHypermediaRuntime()
		runtime.swapElement('#result', '<span>new</span>', 'innerHTML')
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>new</span>')
	})

	it('routes direct swaps through a lifecycle adapter when installed', () => {
		document.body.innerHTML = '<div id="result">old</div>'
		const calls: string[] = []
		const runtime = createHypermediaRuntime({
			swapLifecycleAdapter(operation) {
				calls.push(operation.targetSelector)
				operation.performSwap()
			},
		})

		runtime.swapElement('#result', '<span>new</span>', 'innerHTML')

		expect(calls).toEqual(['#result'])
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>new</span>')
	})

	it('can remove an installed lifecycle adapter', () => {
		document.body.innerHTML = '<div id="result">old</div>'
		const adapter = vi.fn()
		const runtime = createHypermediaRuntime({ swapLifecycleAdapter: adapter })

		;(runtime as { setSwapLifecycleAdapter(adapter: typeof adapter): void }).setSwapLifecycleAdapter(
			null
		)
		runtime.swapElement('#result', '<span>new</span>', 'innerHTML')

		expect(adapter).not.toHaveBeenCalled()
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>new</span>')
	})

	it('swapElement throws for missing target', () => {
		const runtime = createHypermediaRuntime()
		expect(() => runtime.swapElement('#missing', 'x', 'innerHTML')).toThrow()
	})

	it('process wires hypermedia attributes in element', () => {
		document.body.innerHTML = '<div id="container"><a data-aero-on-click="{ GET(\'/api\') }" href="/api">link</a></div>'
		const runtime = createHypermediaRuntime()
		const element = document.querySelector('#container')!
		runtime.process(element)
		const link = element.querySelector('a')!
		expect(link.hasAttribute('data-aero-processed')).toBe(true)
	})

	it('unregisters compiled busy bindings', async () => {
		document.body.innerHTML = '<button id="btn">go</button>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()
		const state = { value: false }
		const unregister = runtime.registerBusyBinding(btn, 'isSaving', state)
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))

		unregister()
		await runtime.executeAction({ method: 'POST', url: '/save', swap: 'none' }, btn)

		expect(state.value).toBe(false)
	})

	it('rejects non-boolean busy and state handles', async () => {
		document.body.innerHTML = '<button id="btn">go</button>'
		const btn = document.querySelector('#btn')!
		const runtime = createHypermediaRuntime()

		expect(() =>
			runtime.registerBusyBinding(btn, 'isSaving', { value: 'no' } as never)
		).toThrow('must be boolean')

		await expect(
			runtime.executeAction({ method: 'POST', url: '/save', state: { value: 'no' } as never }, btn)
		).rejects.toThrow('must be boolean')
	})
})
