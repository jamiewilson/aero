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

		runtime.setSwapLifecycleAdapter(null)
		runtime.swapElement('#result', '<span>new</span>', 'innerHTML')

		expect(adapter).not.toHaveBeenCalled()
		expect(document.querySelector('#result')?.innerHTML).toBe('<span>new</span>')
	})

	it('swapElement throws for missing target', () => {
		const runtime = createHypermediaRuntime()
		expect(() => runtime.swapElement('#missing', 'x', 'innerHTML')).toThrow()
	})

	it('adopt wires hypermedia attributes in container', () => {
		document.body.innerHTML = '<div id="container"><a data-aero-on-click="{ GET(\'/api\') }" href="/api">link</a></div>'
		const runtime = createHypermediaRuntime()
		const container = document.querySelector('#container')!
		runtime.adopt(container)
		const link = container.querySelector('a')!
		expect(link.hasAttribute('data-aero-adopted')).toBe(true)
	})
})
