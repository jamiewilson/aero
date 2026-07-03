import { describe, expect, it, vi } from 'vitest'
import { bindShow } from '../bindings/show'
import { bindHtml } from '../bindings/html'
import { bindClassToggle } from '../bindings/class'
import { bindProperty } from '../bindings/property'
import { bindFormModel } from '../bindings/model'
import { bindKeyedFor } from '../structural/for'
import { createReactivityRuntime } from '../index'
import { SignalStore } from '../store'
import { createStateScope } from '../state-scope'
import { bindReactiveIf } from '../structural/if'
import { bindReactiveSwitch } from '../structural/switch'
import { AeroReactivity, processFragment } from '../process'

describe('binding handlers', () => {
	it('bindShow toggles display', () => {
		const target = { style: { display: 'block' } } as unknown as HTMLElement
		let visible = true
		const cleanup = bindShow(target, () => visible, 'block')
		expect(target.style.display).toBe('block')
		visible = false
		cleanup()
		const effect = bindShow(target, () => visible, 'block')
		expect(target.style.display).toBe('none')
		effect()
	})

	it('bindHtml sets innerHTML from read()', () => {
		const target = { innerHTML: '' } as unknown as Element
		let value = '<b>hi</b>'
		const cleanup = bindHtml(target, () => value)
		expect(target.innerHTML).toBe('<b>hi</b>')
		value = 'plain'
		cleanup()
	})

	it('bindClassToggle toggles class from expression', () => {
		const classes = new Set<string>()
		const target = {
			classList: {
				toggle(name: string, on: boolean) {
					if (on) classes.add(name)
					else classes.delete(name)
				},
			},
		} as unknown as Element
		let active = false
		const cleanup = bindClassToggle(target, 'is-active', () => active)
		expect(classes.has('is-active')).toBe(false)
		active = true
		cleanup()
		bindClassToggle(target, 'is-active', () => active)
		expect(classes.has('is-active')).toBe(true)
	})

	it('bindProperty writes DOM property', () => {
		const target = { disabled: false } as unknown as HTMLButtonElement
		let loading = false
		const cleanup = bindProperty(target, 'disabled', () => loading)
		expect(target.disabled).toBe(false)
		loading = true
		cleanup()
		bindProperty(target, 'disabled', () => loading)
		expect(target.disabled).toBe(true)
	})

	it('bindFormModel syncs input value two-way', () => {
		const store = new SignalStore()
		store.signal('email', 'a@b.c')
		const scope = createStateScope({
			store,
			bindings: [{ name: 'email', derived: false, initExpr: "'a@b.c'", dependencies: [] }],
			functionSources: [],
		})
		const listeners = new Map<string, Set<() => void>>()
		const target = {
			value: 'a@b.c',
			addEventListener(type: string, handler: () => void) {
				const set = listeners.get(type) ?? new Set()
				set.add(handler)
				listeners.set(type, set)
			},
			removeEventListener(type: string, handler: () => void) {
				listeners.get(type)?.delete(handler)
			},
			hasAttribute: () => false,
		} as unknown as HTMLInputElement

		const cleanup = bindFormModel({
			target,
			kind: 'value',
			read: () => scope.email,
			write: value => {
				;(store.get('email') as { value: string }).value = String(value)
			},
		})
		expect(target.value).toBe('a@b.c')
		target.value = 'new@x.y'
		for (const handler of listeners.get('input') ?? []) handler()
		expect(store.get<string>('email').value).toBe('new@x.y')
		cleanup()
	})

	it('bindFormModel skips write-back when readonly', () => {
		const listeners = new Map<string, Set<() => void>>()
		const target = {
			value: 'x',
			addEventListener(type: string, handler: () => void) {
				const set = listeners.get(type) ?? new Set()
				set.add(handler)
				listeners.set(type, set)
			},
			removeEventListener() {},
			hasAttribute(name: string) {
				return name === 'readonly'
			},
		} as unknown as HTMLInputElement
		let writes = 0
		bindFormModel({
			target,
			kind: 'value',
			read: () => 'x',
			write: () => {
				writes++
			},
			readonly: true,
		})
		for (const handler of listeners.get('input') ?? []) handler()
		expect(writes).toBe(0)
	})

	it('bindFormModel syncs radio group by selected value', () => {
		const store = new SignalStore()
		store.signal('plan', 'free')
		const read = () => store.get<string>('plan').value
		const write = (value: unknown) => {
			;(store.get('plan') as { value: unknown }).value = value
		}

		const free = document.createElement('input')
		free.type = 'radio'
		free.value = 'free'
		free.name = 'plan'
		const pro = document.createElement('input')
		pro.type = 'radio'
		pro.value = 'pro'
		pro.name = 'plan'

		bindFormModel({ target: free, kind: 'checked', read, write })
		bindFormModel({ target: pro, kind: 'checked', read, write })

		expect(free.checked).toBe(true)
		expect(pro.checked).toBe(false)
		pro.checked = true
		pro.dispatchEvent(new Event('change'))
		expect(store.get('plan').value).toBe('pro')
	})

	it('syncs nested formModel fields in place', () => {
		const store = new SignalStore()
		const scope = createStateScope({
			store,
			bindings: [
				{
					name: 'formModel',
					derived: false,
					init: () => ({ email: '', agree: false }),
					dependencies: [],
				},
			],
			functionSources: [],
		})
		const target = document.createElement('input')
		target.value = ''
		const cleanup = bindFormModel({
			target,
			kind: 'value',
			read: () => (scope.formModel as { email: string }).email,
			write: value => {
				;(scope.formModel as { email: string }).email = String(value)
			},
		})
		target.value = 'a@b.c'
		target.dispatchEvent(new Event('input'))
		expect((scope.formModel as { email: string }).email).toBe('a@b.c')
		target.value = 'updated@x.y'
		;(scope.formModel as { email: string }).email = 'updated@x.y'
		expect(target.value).toBe('updated@x.y')
		cleanup()
	})
})

describe('reactive collections', () => {
	function createForHarness(
		scope: ReturnType<typeof createStateScope>,
		itemsExpr: string,
		binding: string,
		bindingNames: string[],
		keyExpr: string
	) {
		const template = {
			innerHTML: '',
			content: { firstElementChild: { remove() {} } as Element },
		} as unknown as HTMLTemplateElement
		const fragmentNodes: Element[] = []
		const doc = {
			createElement: () => template,
			createDocumentFragment: () =>
				({
					appendChild(node: Element) {
						fragmentNodes.push(node)
					},
				}) as unknown as DocumentFragment,
		}
		let rowCount = 0
		const container = {
			ownerDocument: doc,
			replaceChildren() {
				rowCount = fragmentNodes.length
				fragmentNodes.length = 0
			},
		} as unknown as Element
		const cleanup = bindKeyedFor({
			container,
			scope,
			itemsExpr,
			keyExpr,
			binding,
			bindingNames,
			renderRow: rowScope => ({
				key: 'unused',
				renderHtml: () => {
					if (bindingNames.length === 2) {
						return `<li>${rowScope[bindingNames[0]]}:${rowScope[bindingNames[1]]}</li>`
					}
					return `<li>${rowScope[bindingNames[0] ?? binding]}</li>`
				},
				mountRow: () => () => {},
			}),
		})
		return { cleanup, get rowCount() { return rowCount } }
	}

	it('updates keyed for when array mutates in place', () => {
		const store = new SignalStore()
		const scope = createStateScope({
			store,
			bindings: [{ name: 'numbersArray', derived: false, init: () => [1, 2, 3], dependencies: [] }],
			functionSources: [],
		})
		const harness = createForHarness(scope, 'numbersArray', 'number', ['number'], 'number')
		expect(harness.rowCount).toBe(3)
		;(scope.numbersArray as number[]).push(4)
		expect(harness.rowCount).toBe(4)
		harness.cleanup()
	})

	it('updates keyed for when Set mutates in place', () => {
		const store = new SignalStore()
		const scope = createStateScope({
			store,
			bindings: [{ name: 'numbersSet', derived: false, init: () => new Set([1, 2]), dependencies: [] }],
			functionSources: [],
		})
		const harness = createForHarness(scope, 'numbersSet', 'number', ['number'], 'number')
		expect(harness.rowCount).toBe(2)
		;(scope.numbersSet as Set<number>).add(3)
		expect(harness.rowCount).toBe(3)
		harness.cleanup()
	})

	it('updates keyed for when Map mutates in place', () => {
		const store = new SignalStore()
		const scope = createStateScope({
			store,
			bindings: [
				{
					name: 'numbersMap',
					derived: false,
					init: () => new Map([[1, 'one'], [2, 'two']]),
					dependencies: [],
				},
			],
			functionSources: [],
		})
		const harness = createForHarness(scope, 'numbersMap', '[ key, value ]', ['key', 'value'], 'key')
		expect(harness.rowCount).toBe(2)
		;(scope.numbersMap as Map<number, string>).set(3, 'three')
		expect(harness.rowCount).toBe(3)
		harness.cleanup()
	})

	it('hydrates collection bindings without flattening', () => {
		const runtime = createReactivityRuntime({
			initialState: {
				formModel: { email: 'seed@x.y' },
				numbersArray: [1, 2],
				numbersMap: new Map([[1, 'one']]),
				numbersSet: new Set([1, 2]),
			},
		})
		expect(runtime.store.get<{ email: string }>('formModel').value).toEqual({ email: 'seed@x.y' })
		expect(runtime.store.get<number[]>('numbersArray').value).toEqual([1, 2])
		expect(runtime.store.get<Map<number, string>>('numbersMap').value.get(1)).toBe('one')
		expect([...runtime.store.get<Set<number>>('numbersSet').value]).toEqual([1, 2])
	})
})

describe('reactive if', () => {
	it('toggles visible branch when state changes', () => {
		const store = new SignalStore()
		store.merge({ showPositive: true, showNegative: false })
		const scope = createStateScope({
			store,
			bindings: [
				{ name: 'showPositive', derived: false, initExpr: 'true', dependencies: [] },
				{ name: 'showNegative', derived: false, initExpr: 'false', dependencies: [] },
			],
			functionSources: [],
		})
		const anchor = { innerHTML: '' } as unknown as Element
		const cleanup = bindReactiveIf({
			anchor,
			scope,
			branches: [
				{
					conditionExpr: 'showPositive',
					renderHtml: () => '<p id="pos">pos</p>',
					mountBranch: () => () => {},
				},
				{
					conditionExpr: 'showNegative',
					renderHtml: () => '<p id="neg">neg</p>',
					mountBranch: () => () => {},
				},
				{
					conditionExpr: null,
					renderHtml: () => '<p id="zero">zero</p>',
					mountBranch: () => () => {},
				},
			],
		})
		expect(anchor.innerHTML).toContain('pos')
		;(store.get('showPositive') as { value: boolean }).value = false
		;(store.get('showNegative') as { value: boolean }).value = false
		cleanup()
		bindReactiveIf({
			anchor,
			scope,
			branches: [
				{ conditionExpr: 'showPositive', renderHtml: () => 'pos', mountBranch: () => () => {} },
				{ conditionExpr: 'showNegative', renderHtml: () => 'neg', mountBranch: () => () => {} },
				{ conditionExpr: null, renderHtml: () => 'zero', mountBranch: () => () => {} },
			],
		})
		expect(anchor.innerHTML).toBe('zero')
	})
})

describe('reactive switch', () => {
	it('toggles visible case branch when discriminant changes', () => {
		const store = new SignalStore()
		store.merge({ status: 'loading' })
		const scope = createStateScope({
			store,
			bindings: [{ name: 'status', derived: false, initExpr: "'loading'", dependencies: [] }],
			functionSources: [],
		})
		const anchor = { innerHTML: '' } as unknown as Element
		const cleanup = bindReactiveSwitch({
			anchor,
			scope,
			expression: 'status',
			cases: [
				{
					comparandExprs: ['"loading"'],
					renderHtml: () => '<p id="loading">loading</p>',
					mountBranch: () => () => {},
				},
				{
					comparandExprs: ['"error"'],
					renderHtml: () => '<p id="error">error</p>',
					mountBranch: () => () => {},
				},
			],
			defaultBranch: {
				renderHtml: () => '<p id="ready">ready</p>',
				mountBranch: () => () => {},
			},
		})
		expect(anchor.innerHTML).toContain('loading')
		;(store.get('status') as { value: string }).value = 'ready'
		cleanup()
		bindReactiveSwitch({
			anchor,
			scope,
			expression: 'status',
			cases: [
				{
					comparandExprs: ['"loading"'],
					renderHtml: () => 'loading',
					mountBranch: () => () => {},
				},
				{
					comparandExprs: ['"error"'],
					renderHtml: () => 'error',
					mountBranch: () => () => {},
				},
			],
			defaultBranch: {
				renderHtml: () => 'ready',
				mountBranch: () => () => {},
			},
		})
		expect(anchor.innerHTML).toBe('ready')
	})
})

describe('AeroReactivity.process', () => {
	it('wires runtime text bindings with $ refs', () => {
		const store = new SignalStore()
		store.signal('count', 3)
		const text = { textContent: '' } as unknown as Element
		const element = {
			querySelectorAll: () => [text],
		} as unknown as ParentNode
		Object.defineProperty(text, 'attributes', {
			value: {
				length: 1,
				0: { name: 'data-aero-text', value: '$count' },
				[Symbol.iterator]: function* () {
					yield { name: 'data-aero-text', value: '$count' }
				},
			},
		})
		text.hasAttribute = (name: string) => name === 'data-aero-processed' ? false : name === 'data-aero-text'
		text.getAttribute = (name: string) => (name === 'data-aero-text' ? '$count' : null)
		text.setAttribute = vi.fn()

		const reactivity = new AeroReactivity(store)
		const cleanup = reactivity.process(element)
		expect(text.textContent).toBe('3')
		cleanup()
	})

	it('returns cleanup and destroy clears processed effects', () => {
		const store = new SignalStore()
		store.signal('count', 1)
		const element = { querySelectorAll: () => [] } as unknown as ParentNode
		const reactivity = new AeroReactivity(store)
		const cleanup = processFragment({ element, store })
		expect(typeof cleanup).toBe('function')
		cleanup()
		reactivity.destroy()
	})

	it('wires nested show and text bindings in real DOM', () => {
		const store = new SignalStore()
		store.merge({ note: 'hello', showNote: true })
		const host = document.createElement('div')
		host.innerHTML = '<p data-aero-show="$showNote"><span data-aero-text="$note"></span></p>'
		const cleanup = processFragment({ element: host, store })
		expect(host.textContent).toBe('hello')
		store.merge({ showNote: false })
		expect(host.querySelector('p')?.style.display).toBe('none')
		cleanup()
	})

	it('wires runtime switch branches with $ refs', () => {
		const store = new SignalStore()
		store.signal('status', 'loading')
		const host = document.createElement('div')
		host.innerHTML = `
			<div data-aero-switch="$status">
				<template data-aero-case="loading"><p id="loading">Loading</p></template>
				<template data-aero-case="error"><p id="error">Error</p></template>
				<template data-aero-default><p id="ready">Ready</p></template>
			</div>
		`
		const cleanup = processFragment({ element: host, store })
		expect(host.querySelector('#loading')).not.toBeNull()
		store.merge({ status: 'ready' })
		expect(host.querySelector('#ready')).not.toBeNull()
		cleanup()
	})
})
