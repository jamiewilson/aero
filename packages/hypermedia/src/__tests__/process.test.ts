import { describe, expect, it, vi } from 'vitest'
import { process } from '../process'
import type { HypermediaRuntime } from '../runtime'

function createMockRuntime(): HypermediaRuntime {
	return {
		kind: 'hypermedia-runtime',
		executeAction: vi.fn().mockResolvedValue({ ok: true, status: 200, html: '', headers: {} }),
		swapElement: vi.fn(),
		process: vi.fn(),
		registerBusyBinding: vi.fn(() => () => {}),
		setSwapLifecycleAdapter: vi.fn(),
	}
}

describe('process', () => {
	it('wires data-aero-on-click with GET action', () => {
		const element = document.createElement('div')
		element.innerHTML = '<a data-aero-on-click="{ GET(\'/api/data\') }" href="/api/data">link</a>'
		const runtime = createMockRuntime()
		process(element, runtime)

		const link = element.querySelector('a')!
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'GET', url: '/api/data' }),
			link
		)
	})

	it('wires data-aero-on-submit with POST action', () => {
		const element = document.createElement('div')
		element.innerHTML = '<form data-aero-on-submit="{ POST(\'/submit\') }" action="/submit"><input name="x"></form>'
		const runtime = createMockRuntime()
		process(element, runtime)

		const form = element.querySelector('form')!
		form.dispatchEvent(new Event('submit', { bubbles: true }))
		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'POST', url: '/submit' }),
			form
		)
	})

	it('skips already-processed elements', () => {
		const element = document.createElement('div')
		element.innerHTML = '<a data-aero-on-click="{ GET(\'/api\') }" data-aero-processed href="/api">link</a>'
		const runtime = createMockRuntime()
		process(element, runtime)

		const link = element.querySelector('a')!
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(runtime.executeAction).not.toHaveBeenCalled()
	})

	it('handles target and swap options', () => {
		const element = document.createElement('div')
		element.innerHTML = '<button data-aero-on-click="{ GET(\'/api\', { target: \'#result\', swap: \'outerHTML\' }) }">go</button>'
		const runtime = createMockRuntime()
		process(element, runtime)

		const btn = element.querySelector('button')!
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'GET', url: '/api', target: '#result', swap: 'outerHTML' }),
			btn
		)
	})

	it('prevents default when event name includes prevent', () => {
		const element = document.createElement('div')
		element.innerHTML = '<form data-aero-on-submit-prevent="{ POST(\'/submit\') }" action="/submit"><input name="x"></form>'
		const runtime = createMockRuntime()
		process(element, runtime)

		const form = element.querySelector('form')!
		const event = new Event('submit', { bubbles: true, cancelable: true })
		form.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
	})

	it('registers runtime busy attributes with $ signal refs', () => {
		const element = document.createElement('div')
		element.innerHTML = '<button data-aero-busy="{ $isSaving }">Save</button>'
		const runtime = createMockRuntime()
		const signal = { value: false }
		const store = { has: () => true, get: () => signal }

		process(element, runtime, store)

		const button = element.querySelector('button')!
		expect(runtime.registerBusyBinding).toHaveBeenCalledWith(button, 'isSaving', signal)
	})

	it('parses runtime action state option with $ signal refs', () => {
		const element = document.createElement('div')
		element.innerHTML = '<button data-aero-on-click="{ POST(\'/save\', { state: $isSaving }) }">Save</button>'
		const runtime = createMockRuntime()
		const signal = { value: false }
		const store = { has: () => true, get: () => signal }

		process(element, runtime, store)
		const button = element.querySelector('button')!
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'POST', url: '/save', state: signal }),
			button
		)
	})

	it('parses autoDisable option from runtime action expressions', () => {
		const element = document.createElement('div')
		element.innerHTML =
			'<button data-aero-on-click="{ GET(\'/api/demo\', { target: \'#result\', autoDisable: true }) }">go</button>'
		const runtime = createMockRuntime()
		process(element, runtime)

		const btn = element.querySelector('button')!
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'GET', url: '/api/demo', target: '#result', autoDisable: true }),
			btn
		)
	})

	it('throws when runtime $ refs resolve to non-boolean signals', () => {
		const element = document.createElement('div')
		element.innerHTML = '<button data-aero-busy="{ $isSaving }">Save</button>'
		const runtime = createMockRuntime()
		const store = { has: () => true, get: () => ({ value: 'yes' }) }

		expect(() => process(element, runtime, store)).toThrow('must be boolean')
	})
})
