import { describe, expect, it, vi } from 'vitest'
import { adopt } from '../adopt'
import type { HypermediaRuntime } from '../runtime'

function createMockRuntime(): HypermediaRuntime {
	return {
		kind: 'hypermedia-runtime',
		executeAction: vi.fn().mockResolvedValue({ ok: true, status: 200, html: '', headers: {} }),
		swapElement: vi.fn(),
		adopt: vi.fn(),
		registerBusyBinding: vi.fn(() => () => {}),
		setSwapLifecycleAdapter: vi.fn(),
	}
}

describe('adopt', () => {
	it('wires data-aero-on-click with GET action', () => {
		const container = document.createElement('div')
		container.innerHTML = '<a data-aero-on-click="{ GET(\'/api/data\') }" href="/api/data">link</a>'
		const runtime = createMockRuntime()
		adopt(container, runtime)

		const link = container.querySelector('a')!
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'GET', url: '/api/data' }),
			link
		)
	})

	it('wires data-aero-on-submit with POST action', () => {
		const container = document.createElement('div')
		container.innerHTML = '<form data-aero-on-submit="{ POST(\'/submit\') }" action="/submit"><input name="x"></form>'
		const runtime = createMockRuntime()
		adopt(container, runtime)

		const form = container.querySelector('form')!
		form.dispatchEvent(new Event('submit', { bubbles: true }))
		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'POST', url: '/submit' }),
			form
		)
	})

	it('skips already-adopted elements', () => {
		const container = document.createElement('div')
		container.innerHTML = '<a data-aero-on-click="{ GET(\'/api\') }" data-aero-adopted href="/api">link</a>'
		const runtime = createMockRuntime()
		adopt(container, runtime)

		const link = container.querySelector('a')!
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(runtime.executeAction).not.toHaveBeenCalled()
	})

	it('handles target and swap options', () => {
		const container = document.createElement('div')
		container.innerHTML = '<button data-aero-on-click="{ GET(\'/api\', { target: \'#result\', swap: \'outerHTML\' }) }">go</button>'
		const runtime = createMockRuntime()
		adopt(container, runtime)

		const btn = container.querySelector('button')!
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'GET', url: '/api', target: '#result', swap: 'outerHTML' }),
			btn
		)
	})

	it('prevents default when event name includes prevent', () => {
		const container = document.createElement('div')
		container.innerHTML = '<form data-aero-on-submit-prevent="{ POST(\'/submit\') }" action="/submit"><input name="x"></form>'
		const runtime = createMockRuntime()
		adopt(container, runtime)

		const form = container.querySelector('form')!
		const event = new Event('submit', { bubbles: true, cancelable: true })
		form.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
	})

	it('registers runtime busy attributes with $ signal refs', () => {
		const container = document.createElement('div')
		container.innerHTML = '<button data-aero-busy="{ $isSaving }">Save</button>'
		const runtime = createMockRuntime()
		const signal = { value: false }
		const store = { has: () => true, get: () => signal }

		adopt(container, runtime, store)

		const button = container.querySelector('button')!
		expect(runtime.registerBusyBinding).toHaveBeenCalledWith(button, 'isSaving', signal)
	})

	it('parses runtime action state option with $ signal refs', () => {
		const container = document.createElement('div')
		container.innerHTML = '<button data-aero-on-click="{ POST(\'/save\', { state: $isSaving }) }">Save</button>'
		const runtime = createMockRuntime()
		const signal = { value: false }
		const store = { has: () => true, get: () => signal }

		adopt(container, runtime, store)
		const button = container.querySelector('button')!
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

		expect(runtime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'POST', url: '/save', state: signal }),
			button
		)
	})

	it('throws when runtime $ refs resolve to non-boolean signals', () => {
		const container = document.createElement('div')
		container.innerHTML = '<button data-aero-busy="{ $isSaving }">Save</button>'
		const runtime = createMockRuntime()
		const store = { has: () => true, get: () => ({ value: 'yes' }) }

		expect(() => adopt(container, runtime, store)).toThrow('must be boolean')
	})
})
