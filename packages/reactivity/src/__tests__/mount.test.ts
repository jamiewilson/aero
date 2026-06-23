import { describe, expect, it } from 'vitest'
import { bindEvent, bindText, mountStateBindings } from '../mount'
import { createStateScope } from '../state-scope'
import { SignalStore } from '../store'

describe('bindText', () => {
	it('updates textContent when read value changes', () => {
		const store = new SignalStore()
		store.signal('count', 1)
		const target = { textContent: '' } as unknown as Node
		const scope = createStateScope({
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '1', dependencies: [] }],
			functionSources: [],
		})

		const cleanup = bindText(target, () => scope.count)
		expect(target.textContent).toBe('1')

		;(store.get('count') as { value: number }).value = 5
		expect(target.textContent).toBe('5')
		cleanup()
	})
})

describe('bindEvent', () => {
	it('invokes handler when event listener is called', () => {
		const listeners = new Map<string, Set<(event: Event) => void>>()
		const target = {
			addEventListener(type: string, handler: (event: Event) => void) {
				const set = listeners.get(type) ?? new Set()
				set.add(handler)
				listeners.set(type, set)
			},
			removeEventListener(type: string, handler: (event: Event) => void) {
				listeners.get(type)?.delete(handler)
			},
		} as unknown as Element

		let clicked = 0
		const cleanup = bindEvent(target, 'click', () => {
			clicked++
		})
		for (const handler of listeners.get('click') ?? []) handler(new Event('click'))
		expect(clicked).toBe(1)
		cleanup()
	})
})

describe('mountStateBindings', () => {
	it('wires reactive text and click handlers from state scope', () => {
		const text = { textContent: '1' } as unknown as Element
		const button = {
			addEventListener(type: string, handler: (event: Event) => void) {
				button.handlers.push(handler)
			},
			removeEventListener(_type: string, handler: (event: Event) => void) {
				button.handlers = button.handlers.filter(item => item !== handler)
			},
			handlers: [] as Array<(event: Event) => void>,
		} as unknown as Element & { handlers: Array<(event: Event) => void> }

		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-event="0"]') return button
				if (selector === '[data-aero-text="1"]') return text
				return null
			},
		} as unknown as ParentNode

		const store = new SignalStore()
		store.merge({ count: 1 })

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '1', dependencies: [] }],
			functionSources: ['function inc() { count++ }'],
			textBinds: [{ selector: '[data-aero-text="1"]', readExpr: 'String(count)' }],
			eventBinds: [{ selector: '[data-aero-event="0"]', event: 'click', handlerExpr: 'inc()' }],
		})

		expect(text.textContent).toBe('1')
		for (const handler of button.handlers) handler(new Event('click'))
		expect(text.textContent).toBe('2')
		cleanup()
	})

	it('wires inline count++ / count-- handlers against signal store', () => {
		const text = { textContent: '0' } as unknown as Element
		const minus = {
			addEventListener(type: string, handler: (event: Event) => void) {
				minus.handlers.push(handler)
			},
			removeEventListener(_type: string, handler: (event: Event) => void) {
				minus.handlers = minus.handlers.filter(item => item !== handler)
			},
			handlers: [] as Array<(event: Event) => void>,
		} as unknown as Element & { handlers: Array<(event: Event) => void> }
		const plus = {
			addEventListener(type: string, handler: (event: Event) => void) {
				plus.handlers.push(handler)
			},
			removeEventListener(_type: string, handler: (event: Event) => void) {
				plus.handlers = plus.handlers.filter(item => item !== handler)
			},
			handlers: [] as Array<(event: Event) => void>,
		} as unknown as Element & { handlers: Array<(event: Event) => void> }

		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-event="0"]') return minus
				if (selector === '[data-aero-text="1"]') return text
				if (selector === '[data-aero-event="2"]') return plus
				return null
			},
		} as unknown as ParentNode

		const store = new SignalStore()
		store.merge({ count: 0 })

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '0', dependencies: [] }],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="1"]', readExpr: 'String(count)' }],
			eventBinds: [
				{ selector: '[data-aero-event="0"]', event: 'click', handlerExpr: 'count--' },
				{ selector: '[data-aero-event="2"]', event: 'click', handlerExpr: 'count++' },
			],
		})

		expect(text.textContent).toBe('0')
		for (const handler of plus.handlers) handler(new Event('click'))
		expect(text.textContent).toBe('1')
		for (const handler of minus.handlers) handler(new Event('click'))
		expect(text.textContent).toBe('0')
		cleanup()
	})

	it('tracks derived bindings', () => {
		const text = { textContent: '2' } as unknown as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-text="0"]') return text
				return null
			},
		} as unknown as ParentNode

		const store = new SignalStore()
		store.merge({ count: 1 })

		mountStateBindings({
			root,
			store,
			bindings: [
				{ name: 'count', derived: false, initExpr: '1', dependencies: [] },
				{ name: 'doubled', derived: true, initExpr: 'count * 2', dependencies: ['count'] },
			],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="0"]', readExpr: 'String(doubled)' }],
			eventBinds: [],
		})

		expect(text.textContent).toBe('2')
		;(store.get('count') as { value: number }).value = 3
		expect(text.textContent).toBe('6')
	})

	it('resolves is:state import constants in reactive read expressions', () => {
		const AuthState = { SignedIn: 'SignedIn', SignedOut: 'SignedOut' }
		const text = { textContent: '' } as unknown as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-text="0"]') return text
				return null
			},
		} as unknown as ParentNode

		const store = new SignalStore()
		store.merge({ authState: AuthState.SignedOut })

		expect(() =>
			mountStateBindings({
				root,
				store,
				bindings: [
					{ name: 'authState', derived: false, initExpr: 'AuthState.SignedOut', dependencies: [] },
				],
				functionSources: [],
				textBinds: [
					{
						selector: '[data-aero-text="0"]',
						readExpr: 'authState === AuthState.SignedIn ? "Log Out" : "Log In"',
					},
				],
				eventBinds: [],
				scopeConstants: { AuthState },
			})
		).not.toThrow()

		expect(text.textContent).toBe('Log In')
		;(store.get('authState') as { value: string }).value = AuthState.SignedIn
		expect(text.textContent).toBe('Log Out')
	})

	it('lets lifecycle response handlers update state from hypermedia action events', () => {
		function createFakeElement() {
			const listeners = new Map<string, Array<(this: Element, event: Event) => void>>()
			const attrs = new Map<string, string>()
			const el = {
				addEventListener(type: string, handler: (this: Element, event: Event) => void) {
					listeners.set(type, [...(listeners.get(type) ?? []), handler])
				},
				removeEventListener(type: string, handler: (this: Element, event: Event) => void) {
					listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== handler))
				},
				dispatch(type: string) {
					for (const handler of listeners.get(type) ?? []) {
						handler.call(el as unknown as Element, new Event(type))
					}
				},
				setAttribute(name: string, value: string) {
					attrs.set(name, value)
				},
				getAttribute(name: string) {
					return attrs.get(name) ?? null
				},
			}
			return el
		}

		const button = createFakeElement()
		const target = createFakeElement()
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-event="0"]') return button
				if (selector === '[data-aero-event="1"]') return target
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ count: 0 })
		const hypermediaRuntime = {
			executeAction() {
				target.dispatch('response')
				return Promise.resolve({})
			},
			registerBusyBinding() {},
		}

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '0', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [
				{
					selector: '[data-aero-event="0"]',
					event: 'click',
					handlerExpr: "GET('/api/save', { target: '#result' })",
				},
				{
					selector: '[data-aero-event="1"]',
					event: 'response',
					handlerExpr: 'count++; this.setAttribute("data-count", String(count))',
				},
			],
			hypermediaRuntime,
		})

		button.dispatch('click')

		expect((store.get('count') as { value: number }).value).toBe(1)
		expect(target.getAttribute('data-count')).toBe('1')
		cleanup()
	})
})
