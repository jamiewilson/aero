import { describe, expect, it, vi } from 'vitest'
import { dispatchLifecycleEvent } from '../events'
import type { HypermediaRequest } from '../types'

describe('dispatchLifecycleEvent', () => {
	it('dispatches on document when no element given', () => {
		const request: HypermediaRequest = { method: 'GET', url: '/test', headers: {} }
		const handler = vi.fn()
		document.addEventListener('aero:request', handler)

		dispatchLifecycleEvent('aero:request', { request })

		expect(handler).toHaveBeenCalledTimes(1)
		const event = handler.mock.calls[0][0] as CustomEvent
		expect(event.detail.request.url).toBe('/test')
		document.removeEventListener('aero:request', handler)
	})

	it('dispatches on the given element', () => {
		const request: HypermediaRequest = { method: 'GET', url: '/test', headers: {} }
		const target = document.createElement('div')
		const handler = vi.fn()
		target.addEventListener('aero:request', handler)

		dispatchLifecycleEvent('aero:request', { request }, target)

		expect(handler).toHaveBeenCalledTimes(1)
		const event = handler.mock.calls[0][0] as CustomEvent
		expect(event.detail.request.url).toBe('/test')
	})

	it('event bubbles to document from element', () => {
		const request: HypermediaRequest = { method: 'GET', url: '/test', headers: {} }
		const target = document.createElement('div')
		document.body.appendChild(target)
		const handler = vi.fn()
		document.addEventListener('aero:request', handler)

		dispatchLifecycleEvent('aero:request', { request }, target)

		expect(handler).toHaveBeenCalledTimes(1)
		document.body.removeChild(target)
		document.removeEventListener('aero:request', handler)
	})

	it('dispatches aero:error event with error detail', () => {
		const request: HypermediaRequest = { method: 'GET', url: '/test', headers: {} }
		const error = new Error('Network failure')
		const handler = vi.fn()
		document.addEventListener('aero:error', handler)

		dispatchLifecycleEvent('aero:error', { request, error })

		expect(handler).toHaveBeenCalledTimes(1)
		const event = handler.mock.calls[0][0] as CustomEvent
		expect(event.detail.error?.message).toBe('Network failure')
		document.removeEventListener('aero:error', handler)
	})

	it('dispatches aero:swap event with swap detail', () => {
		const request: HypermediaRequest = { method: 'GET', url: '/test', headers: {} }
		const handler = vi.fn()
		document.addEventListener('aero:swap', handler)

		dispatchLifecycleEvent('aero:swap', {
			request,
			swapStyle: 'innerHTML',
			target: '#result',
		})

		expect(handler).toHaveBeenCalledTimes(1)
		const event = handler.mock.calls[0][0] as CustomEvent
		expect(event.detail.swapStyle).toBe('innerHTML')
		expect(event.detail.target).toBe('#result')
		document.removeEventListener('aero:swap', handler)
	})
})
