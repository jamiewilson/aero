/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { mountStateBindings } from '../mount'
import { processFragment, unsafeProcessFragment } from '../process'
import { SignalStore } from '../store'

describe('CSP contract', () => {
	it('compiled mount path does not call new Function', () => {
		const fnSpy = vi.spyOn(globalThis, 'Function')
		const store = new SignalStore()
		const root = document.createElement('div')
		root.innerHTML = '<span data-aero-text="0"></span>'

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, init: () => 1, dependencies: [] }],
			textBinds: [
				{
					selector: '[data-aero-text="0"]',
					read: (scope, escapeHtml) => escapeHtml?.(String(scope.count)),
				},
			],
			eventBinds: [],
			escapeHtml: v => String(v),
		})

		expect(root.textContent).toBe('1')
		expect(fnSpy).not.toHaveBeenCalled()
		cleanup()
		fnSpy.mockRestore()
	})

	it('processFragment rejects arbitrary expressions', () => {
		const store = new SignalStore()
		store.signal('count', 1)
		const host = document.createElement('div')
		host.innerHTML = '<span data-aero-text="{ count + 1 }"></span>'
		expect(() => processFragment({ element: host, store })).toThrow(/Restricted process/)
	})

	it('unsafeProcessFragment allows $store refs', () => {
		const store = new SignalStore()
		store.signal('count', 1)
		const host = document.createElement('div')
		host.innerHTML = '<span data-aero-text="$count"></span>'
		const cleanup = unsafeProcessFragment({ element: host, store })
		expect(host.textContent).toBe('1')
		cleanup()
	})
})
