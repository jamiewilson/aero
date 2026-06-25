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

	it('renders literal quotes instead of HTML entities', () => {
		const target = { textContent: '' } as unknown as Node
		const cleanup = bindText(target, () => `bind:count="{ 5 }"`)
		expect(target.textContent).toBe('bind:count="{ 5 }"')
		expect(target.textContent).not.toContain('&quot;')
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
	it('resolves text binds on the mount root element itself', () => {
		const target = {
			textContent: '',
			matches(selector: string) {
				return selector === '[data-aero-text="0"]'
			},
			querySelectorAll() {
				return []
			},
			querySelector() {
				return null
			},
		} as unknown as Element

		const store = new SignalStore()
		const cleanup = mountStateBindings({
			root: target,
			store,
			bindings: [],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="0"]', readExpr: '"Alpha"' }],
			eventBinds: [],
			Aero: {},
		})

		expect(target.textContent).toBe('Alpha')
		cleanup()
	})

	it('evaluates subset binds against a provided row scope', () => {
		const store = new SignalStore()
		store.merge({ items: [{ id: 1, label: 'Alpha' }] })
		const pageScope = createStateScope({
			store,
			bindings: [{ name: 'items', derived: false, initExpr: '[]', dependencies: [] }],
			functionSources: [],
		})
		const rowScope = Object.create(pageScope) as ReturnType<typeof createStateScope>
		Object.defineProperty(rowScope, 'item', {
			configurable: true,
			enumerable: true,
			writable: true,
			value: { id: 1, label: 'Beta' },
		})

		const target = {
			textContent: '',
			matches(selector: string) {
				return selector === '[data-aero-text="0"]'
			},
			querySelectorAll() {
				return []
			},
			querySelector() {
				return null
			},
		} as unknown as Element

		const cleanup = mountStateBindings({
			root: target,
			store,
			scope: rowScope,
			bindings: [{ name: 'items', derived: false, initExpr: '[]', dependencies: [] }],
			functionSources: [],
			textBinds: [{ selector: '[data-aero-text="0"]', readExpr: 'String( item.label )' }],
			eventBinds: [],
			Aero: {},
		})

		expect(target.textContent).toBe('Beta')
		cleanup()
	})

	it('aliases bindable live props to the passed signal instead of creating owned state', () => {
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
					bindable: true,
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

	it('mounts child component bindings with readonly live prop signal aliases', () => {
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
					livePropExprs: { count: { expr: 'count', mutable: false } },
				},
			],
			Aero: aero,
		})

		expect(childMount).toHaveBeenCalledWith(childRoot, aero, {
			store: expect.any(SignalStore),
			liveProps: { count: expect.objectContaining({ value: 1 }) },
		})
		const calls = childMount.mock.calls as unknown as Array<
			[Element, unknown, { store: SignalStore; liveProps: Record<string, { value: unknown }> }]
		>
		expect(calls[0]?.[2].store).not.toBe(store)
		expect(calls[0]?.[2].liveProps.count).not.toBe(store.get('count'))
		expect(() => {
			calls[0]![2].liveProps.count.value = 2
		}).toThrow('Readonly live prop cannot be assigned: count')
		cleanup()
		expect(childCleanup).toHaveBeenCalledTimes(1)
	})

	it('mounts bind component props with mutable live prop signal aliases', () => {
		const childRoot = {} as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return childRoot
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ count: 1 })
		let liveProps: Record<string, { value: unknown }> | undefined
		const childMount = vi.fn((_root, _aero, opts) => {
			liveProps = opts.liveProps
			return () => {}
		})

		mountStateBindings({
			root,
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '1', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: { mountStateBindings: childMount },
					livePropExprs: { count: { expr: 'count', mutable: true } },
				},
			],
			Aero: {},
		})

		expect(liveProps?.count).toBe(store.get('count'))
		liveProps!.count.value = 2
		expect(store.get('count').value).toBe(2)
	})

	it('maps renamed live props from parent attribute names to child prop names', () => {
		const childRoot = {} as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return childRoot
				return null
			},
		} as unknown as ParentNode
		const store = new SignalStore()
		store.merge({ title: 'Hello' })
		let liveProps: Record<string, { value: unknown }> | undefined
		const childMount = vi.fn((_root, _aero, opts) => {
			liveProps = opts.liveProps
			return () => {}
		})

		mountStateBindings({
			root,
			store,
			bindings: [{ name: 'title', derived: false, initExpr: "'Hello'", dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: { mountStateBindings: childMount },
					livePropExprs: { heading: { expr: 'title', mutable: false } },
				},
			],
			Aero: {},
		})

		expect(liveProps?.heading.value).toBe('Hello')
		;(store.get('title') as { value: string }).value = 'Updated'
		expect(liveProps?.heading.value).toBe('Updated')
	})

	it('creates an independent store for each child component instance', () => {
		const firstRoot = {} as Element
		const secondRoot = {} as Element
		const root = {
			querySelectorAll(selector: string) {
				if (selector === '[data-aero-component="0"]') return [firstRoot]
				if (selector === '[data-aero-component="1"]') return [secondRoot]
				return []
			},
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return firstRoot
				if (selector === '[data-aero-component="1"]') return secondRoot
				return null
			},
		} as unknown as ParentNode
		const parentStore = new SignalStore()
		parentStore.merge({ count: 1 })
		const childMount = vi.fn(() => () => {})

		mountStateBindings({
			root,
			store: parentStore,
			bindings: [{ name: 'count', derived: false, initExpr: '1', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: { mountStateBindings: childMount },
					livePropExprs: {},
				},
				{
					selector: '[data-aero-component="1"]',
					component: { mountStateBindings: childMount },
					livePropExprs: {},
				},
			],
			Aero: {},
		})

		const calls = childMount.mock.calls as unknown as Array<
			[Element, unknown, { store: SignalStore }]
		>
		const firstStore = calls[0]?.[2].store
		const secondStore = calls[1]?.[2].store
		expect(firstStore).toBeInstanceOf(SignalStore)
		expect(secondStore).toBeInstanceOf(SignalStore)
		expect(firstStore).not.toBe(secondStore)
		expect(firstStore).not.toBe(parentStore)
		expect(secondStore).not.toBe(parentStore)
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

		expect(childMount).toHaveBeenCalledWith(childRoot, {}, {
			store: expect.any(SignalStore),
			liveProps: {},
		})
		cleanup()
		expect(childCleanup).toHaveBeenCalledTimes(1)
	})

	it('passes plain live prop aliases that fail loudly on child writes', () => {
		const childRoot = {} as Element
		const root = {
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return childRoot
				return null
			},
		} as unknown as ParentNode
		const parentStore = new SignalStore()
		parentStore.merge({ count: 1 })
		let liveProps: Record<string, { value: unknown }> | undefined
		const childMount = vi.fn((_root, _aero, opts) => {
			liveProps = opts.liveProps
			return () => {}
		})

		mountStateBindings({
			root,
			store: parentStore,
			bindings: [{ name: 'count', derived: false, initExpr: '1', dependencies: [] }],
			functionSources: [],
			textBinds: [],
			eventBinds: [],
			componentBinds: [
				{
					selector: '[data-aero-component="0"]',
					component: { mountStateBindings: childMount },
					livePropExprs: { count: { expr: 'count', mutable: false } },
				},
			],
			Aero: {},
		})

		expect(liveProps?.count.value).toBe(1)
		expect(() => {
			liveProps!.count.value = 2
		}).toThrow('Readonly live prop cannot be assigned: count')
		expect(parentStore.get('count').value).toBe(1)
	})

	it('binds page text markers when child components reuse the same bind id', () => {
		const childText = { textContent: '0', tagName: 'SPAN' } as unknown as Element
		const pageText = { textContent: '0', tagName: 'H2' } as unknown as Element
		const componentRoot = {
			tagName: 'SPAN',
			hasAttribute(name: string) {
				return name === 'data-aero-component'
			},
		} as unknown as Element

		const documentRoot = {
			querySelectorAll(selector: string) {
				if (selector === '[data-aero-component]') return [componentRoot]
				return []
			},
		} as unknown as ParentNode

		const root = {
			tagName: 'BODY',
			hasAttribute() {
				return false
			},
			getRootNode() {
				return documentRoot
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

		Object.defineProperty(childText, 'parentNode', { value: componentRoot })
		Object.defineProperty(componentRoot, 'parentNode', { value: root })
		Object.defineProperty(pageText, 'parentNode', { value: root })

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
					livePropExprs: { count: { expr: 'count', mutable: false } },
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

	it('binds page text markers inside layout wrappers but outside registered child components', () => {
		const layoutRoot = {
			tagName: 'SPAN',
			hasAttribute(name: string) {
				return name === 'data-aero-component'
			},
		} as unknown as Element
		const childComponentRoot = {
			tagName: 'SPAN',
			hasAttribute() {
				return true
			},
		} as unknown as Element
		const childText = { textContent: '0', tagName: 'SPAN' } as unknown as Element
		const pageText = { textContent: '0', tagName: 'H2' } as unknown as Element

		const root = {
			tagName: 'BODY',
			hasAttribute() {
				return false
			},
			querySelector(selector: string) {
				if (selector === '[data-aero-component="0"]') return layoutRoot
				if (selector === '[data-aero-component="1"]') return childComponentRoot
				return null
			},
			querySelectorAll(selector: string) {
				if (selector === '[data-aero-text="0"]') return [childText, pageText]
				return []
			},
		} as unknown as ParentNode

		Object.defineProperty(childComponentRoot, 'parentNode', { value: layoutRoot })
		Object.defineProperty(layoutRoot, 'parentNode', { value: root })
		Object.defineProperty(childText, 'parentNode', { value: childComponentRoot })
		Object.defineProperty(pageText, 'parentNode', { value: layoutRoot })

		const store = new SignalStore()
		store.merge({ count: 0 })
		const childMount = vi.fn(() => () => {})

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
					component: {},
					livePropExprs: {},
				},
				{
					selector: '[data-aero-component="1"]',
					component: { mountStateBindings: childMount },
					livePropExprs: {},
				},
			],
		})

		expect(pageText.textContent).toBe('0')
		;(store.get('count') as { value: number }).value = 9
		expect(pageText.textContent).toBe('9')
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
					livePropExprs: { count: { expr: 'count', mutable: false } },
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

	it('skips absent component binds on component mounts for inactive conditional branches', () => {
		const componentRoot = {
			hasAttribute(name: string) {
				return name === 'data-aero-component'
			},
			getAttribute(name: string) {
				return name === 'data-aero-component' ? '1' : null
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
				textBinds: [],
				eventBinds: [],
				componentBinds: [
					{
						selector: '[data-aero-component="0"]',
						component: {},
						livePropExprs: {},
					},
				],
				Aero: {},
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
				},
			],
			functionSources: [],
		})

		expect(() => {
			scope.count = 2
		}).toThrow('Readonly live prop cannot be assigned: count')
	})

	it('allows bindable live props to be assigned', () => {
		const parentStore = new SignalStore()
		const childStore = new SignalStore()
		const parentCount = parentStore.signal('count', 1)
		const scope = createStateScope({
			store: childStore,
			liveProps: { count: parentCount },
			bindings: [
				{
					name: 'count',
					derived: false,
					initExpr: 'undefined',
					dependencies: [],
					liveProp: true,
					required: false,
					bindable: true,
				},
			],
			functionSources: [],
		})

		scope.count = 2
		expect(parentCount.value).toBe(2)
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
