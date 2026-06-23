import { describe, expect, it, vi } from 'vitest'
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
	it('aliases live props to the passed signal instead of creating owned state', () => {
		const text = { textContent: '1' } as unknown as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-text="0"]') return text
				return null
			},
		} as unknown as ParentNode

		const parentStore = new SignalStore()
		const parentCount = parentStore.signal('count', 1)
		const childStore = new SignalStore()

		const cleanup = mountStateBindings({
			root,
			store: childStore,
			liveProps: { count: parentCount },
			bindings: [
				{
					name: 'count',
					derived: false,
					initExpr: 'undefined',
					dependencies: [],
					liveProp: true,
					required: true,
				},
			],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="0"]', readExpr: 'String(count)' }],
			eventBinds: [],
		})

		expect(text.textContent).toBe('1')
		;(childStore.get('count') as { value: number }).value = 2
		expect(parentCount.value).toBe(2)
		expect(text.textContent).toBe('2')
		cleanup()
	})

	it('mounts child component bindings with live prop signal aliases', () => {
		const childRoot = {} as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return childRoot
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ count: 1 })
		const childCleanup = vi.fn()
		const childMount = vi.fn(() => childCleanup)
		const childComponent = { mountStateBindings: childMount }
		const aero = {}

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '1', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: childComponent,
					livePropExprs: { count: 'count' },
				},
			],
			Aero: aero,
		})

		expect(childMount).toHaveBeenCalledWith(childRoot, aero, {
			liveProps: { count: store.get('count') },
		})
		cleanup()
		expect(childCleanup).toHaveBeenCalledTimes(1)
	})

	it('mounts child component bindings without live props', () => {
		const childRoot = {} as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return childRoot
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		const childCleanup = vi.fn()
		const childMount = vi.fn(() => childCleanup)
		const childComponent = { mountStateBindings: childMount }

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: childComponent,
					livePropExprs: {},
				},
			],
			Aero: {},
		})

		expect(childMount).toHaveBeenCalledWith(childRoot, {}, { liveProps: {} })
		cleanup()
		expect(childCleanup).toHaveBeenCalledTimes(1)
	})

	it('binds page text markers when child components reuse the same bind id', () => {
		const childText = { textContent: '0', tagName: 'SPAN' } as unknown as Element
		const pageText = { textContent: '0', tagName: 'H2' } as unknown as Element
		const componentRoot = {
			tagName: 'SPAN',
			hasAttribute(name: string) {
				return name === 'data-aero-component'
			},
			closest() {
				return componentRoot
			},
		} as unknown as Element

		Object.defineProperty(childText, 'closest', {
			value(selector: string) {
				return selector === '[data-aero-component]' ? componentRoot : null
			},
		})
		Object.defineProperty(pageText, 'closest', {
			value() {
				return null
			},
		})

		const root = {
			tagName: 'BODY',
			hasAttribute() {
				return false
			},
			querySelector(selector: string) {
				if (selector === '[data-aero-text="0"]') return childText
				if (selector === '[data-aero-component="0"]') return componentRoot
				return null
			},
			querySelectorAll(selector: string) {
				if (selector === '[data-aero-text="0"]') return [childText, pageText]
				return []
			},
		} as unknown as ParentNode

		const store = new SignalStore()
		store.merge({ count: 0 })
		const childMount = vi.fn(() => () => {})
		const childComponent = { mountStateBindings: childMount }

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '0', dependencies: [] }],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="0"]', readExpr: 'String(count)' }],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: childComponent,
					livePropExprs: { count: 'count' },
				},
			],
		})

		expect(pageText.textContent).toBe('0')
		;(store.get('count') as { value: number }).value = 3
		expect(pageText.textContent).toBe('3')
		expect(childText.textContent).toBe('0')
		expect(childMount).toHaveBeenCalled()
		cleanup()
	})

	it('resolves mountStateBindings from imported component module objects', () => {
		const childRoot = {
			tagName: 'SPAN',
			hasAttribute(name: string) {
				return name === 'data-aero-component'
			},
			querySelectorAll(selector: string) {
				if (selector === '[data-aero-text="0"]') {
					return [{ textContent: '0', tagName: 'SPAN', closest: () => childRoot }]
				}
				return []
			},
			querySelector(selector: string) {
				if (selector === '[data-aero-text="0"]') {
					return { textContent: '0', tagName: 'SPAN', closest: () => childRoot }
				}
				return null
			},
		} as unknown as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return childRoot
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ count: 2 })
		const childMount = vi.fn(() => () => {})
		const childModule = { default: vi.fn(), mountStateBindings: childMount }

		mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '2', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: childModule,
					livePropExprs: { count: 'count' },
				},
			],
		})

		expect(childMount).toHaveBeenCalled()
	})

	it('finds bind targets inside display:contents component roots when query APIs return empty', () => {
		const componentRoot = {
			tagName: 'SPAN',
			hasAttribute(name: string) {
				return name === 'data-aero-component'
			},
			getAttribute(name: string) {
				return name === 'data-aero-component' ? '0' : null
			},
			matches: () => false,
			get childNodes() {
				return [] as unknown as NodeListOf<ChildNode>
			},
			querySelectorAll() {
				return []
			},
			querySelector() {
				return null
			},
			getRootNode() {
				return documentRoot
			},
		} as unknown as Element
		const childText = {
			textContent: '0',
			tagName: 'SPAN',
			parentNode: componentRoot,
		} as unknown as Element
		const documentRoot = {
			querySelectorAll(selector: string) {
				if (selector === '[data-aero-text="0"]') return [childText]
				return []
			},
		} as unknown as ParentNode

		const store = new SignalStore()
		store.merge({ count: 1 })

		const cleanup = mountStateBindings({
			root: componentRoot,
			store,
			liveProps: { count: store.get('count') },
			bindings: [
				{
					name: 'count',
					derived: false,
					initExpr: 'undefined',
					dependencies: [],
					liveProp: true,
					required: true,
				},
			],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="0"]', readExpr: 'String(count)' }],
			eventBinds: [],
		})

		expect(childText.textContent).toBe('1')
		;(store.get('count') as { value: number }).value = 4
		expect(childText.textContent).toBe('4')
		cleanup()
	})

	it('skips absent text binds on component mounts for inactive conditional branches', () => {
		const componentRoot = {
			hasAttribute(name: string) {
				return name === 'data-aero-component'
			},
			getAttribute(name: string) {
				return name === 'data-aero-component' ? '0' : null
			},
			querySelectorAll() {
				return []
			},
			querySelector() {
				return null
			},
			get childNodes() {
				return [] as unknown as NodeListOf<ChildNode>
			},
			matches: () => false,
			getRootNode() {
				return { querySelectorAll: () => [] }
			},
		} as unknown as Element

		expect(() =>
			mountStateBindings({
				root: componentRoot,
				store: new SignalStore(),
				bindings: [],
				functionSources: [],
				textBinds: [{ selector: '[data-aero-text="0"]', readExpr: '"missing"' }],
				eventBinds: [],
			}),
		).not.toThrow()
	})

	it('creates local state for omitted optional live props', () => {
		const text = { textContent: '' } as unknown as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-text="0"]') return text
				return null
			},
		} as unknown as ParentNode
		const childStore = new SignalStore()

		const cleanup = mountStateBindings({
			root,
			store: childStore,
			liveProps: {},
			bindings: [
				{
					name: 'label',
					derived: false,
					initExpr: '"Counter"',
					dependencies: [],
					liveProp: true,
					required: false,
				},
			],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="0"]', readExpr: 'label' }],
			eventBinds: [],
		})

		expect(text.textContent).toBe('Counter')
		;(childStore.get('label') as { value: string }).value = 'Local'
		expect(text.textContent).toBe('Local')
		cleanup()
	})

	it('fails loudly when a required live prop is omitted', () => {
		expect(() =>
			createStateScope({
				store: new SignalStore(),
				liveProps: {},
				bindings: [
					{
						name: 'count',
						derived: false,
						initExpr: 'undefined',
						dependencies: [],
						liveProp: true,
						required: true,
					},
				],
				functionSources: [],
			})
		).toThrow('Required live prop was not provided: count')
	})

	it('fails loudly when readonly live props are assigned', () => {
		const parentStore = new SignalStore()
		const childStore = new SignalStore()
		const scope = createStateScope({
			store: childStore,
			liveProps: { count: parentStore.signal('count', 1) },
			bindings: [
				{
					name: 'count',
					derived: false,
					initExpr: 'undefined',
					dependencies: [],
					liveProp: true,
					required: true,
					readonly: true,
				},
			],
			functionSources: [],
		})

		expect(() => {
			scope.count = 2
		}).toThrow('Readonly live prop cannot be assigned: count')
	})

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
		for (const handler of button.handlers) handler.call(button, new Event('click'))
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
		for (const handler of plus.handlers) handler.call(plus, new Event('click'))
		expect(text.textContent).toBe('1')
		for (const handler of minus.handlers) handler.call(minus, new Event('click'))
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
			registerBusyBinding() {
				return () => {}
			},
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

	it('registers compiled busy bindings and unregisters them on cleanup', () => {
		const button = {} as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-busy="0"]') return button
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ isSaving: false })
		const unregister = vi.fn()
		const hypermediaRuntime = {
			executeAction() {
				return Promise.resolve({})
			},
			registerBusyBinding: vi.fn(() => unregister),
		}

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'isSaving', derived: false, initExpr: 'false', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			busyBinds: [{ selector: '[data-aero-busy="0"]', readExpr: 'isSaving' }],
			hypermediaRuntime,
		})

		expect(hypermediaRuntime.registerBusyBinding).toHaveBeenCalledWith(
			button,
			'isSaving',
			store.get('isSaving')
		)
		cleanup()
		expect(unregister).toHaveBeenCalledTimes(1)
	})

	it('rejects non-boolean compiled busy signals', () => {
		const button = {} as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-busy="0"]') return button
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ isSaving: 'no' })

		expect(() =>
			mountStateBindings({
				root,
				store,
				bindings: [{ name: 'isSaving', derived: false, initExpr: '"no"', dependencies: [] }],
				functionSources: [],
				textBinds: [],
				eventBinds: [],
				busyBinds: [{ selector: '[data-aero-busy="0"]', readExpr: 'isSaving' }],
				hypermediaRuntime: {
					executeAction() {
						return Promise.resolve({})
					},
					registerBusyBinding() {
						return () => {}
					},
				},
			})
		).toThrow('must be boolean')
	})

	it('passes compiled action state options as signal handles', () => {
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
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ isSaving: false })
		const hypermediaRuntime = {
			executeAction: vi.fn(() => Promise.resolve({})),
			registerBusyBinding() {
				return () => {}
			},
		}

		const cleanup = mountStateBindings({
			root,
			store,
			bindings: [{ name: 'isSaving', derived: false, initExpr: 'false', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [
				{
					selector: '[data-aero-event="0"]',
					event: 'click',
					handlerExpr: "POST('/save', { state: isSaving })",
				},
			],
			hypermediaRuntime,
		})

		for (const handler of button.handlers) handler.call(button, new Event('click'))

		expect(hypermediaRuntime.executeAction).toHaveBeenCalledWith(
			expect.objectContaining({ state: store.get('isSaving') }),
			button
		)
		cleanup()
	})
})
