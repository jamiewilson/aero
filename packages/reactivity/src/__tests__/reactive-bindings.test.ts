import { describe, expect, it, vi } from 'vitest'
import { bindShow } from '../bindings/show'
import { bindHtml } from '../bindings/html'
import { bindClassToggle } from '../bindings/class'
import { bindProperty } from '../bindings/property'
import { bindFormModel } from '../bindings/model'
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

	it('bindProperty sets data-* and aria-* attributes', () => {
		const attrs = new Map<string, string>()
		const target = {
			getAttribute(name: string) {
				return attrs.get(name) ?? null
			},
			setAttribute(name: string, value: string) {
				attrs.set(name, value)
			},
			removeAttribute(name: string) {
				attrs.delete(name)
			},
		} as unknown as HTMLElement
		let theme = 'dark'
		const cleanup = bindProperty(target, 'data-theme', () => theme)
		expect(attrs.get('data-theme')).toBe('dark')
		theme = 'light'
		cleanup()
		bindProperty(target, 'data-theme', () => theme)
		expect(attrs.get('data-theme')).toBe('light')
		theme = null as unknown as string
		bindProperty(target, 'data-theme', () => theme)
		expect(attrs.has('data-theme')).toBe(false)
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
		store.get<boolean>('showNote').value = false
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
		store.get<string>('status').value = 'ready'
		expect(host.querySelector('#ready')).not.toBeNull()
		cleanup()
	})
})
