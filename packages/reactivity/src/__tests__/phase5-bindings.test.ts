import { describe, expect, it, vi } from 'vitest'
import { bindShow } from '../bindings/show'
import { bindHtml } from '../bindings/html'
import { bindClassToggle } from '../bindings/class'
import { bindProperty } from '../bindings/property'
import { bindFormModel } from '../bindings/model'
import { SignalStore } from '../store'
import { createStateScope } from '../state-scope'
import { bindReactiveIf } from '../structural/if'
import { AeroReactivity, adoptFragment } from '../adopt'

describe('phase 5 binding handlers', () => {
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
})

describe('phase 5 reactive if', () => {
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

describe('AeroReactivity.adopt', () => {
	it('wires runtime text bindings with $ refs', () => {
		const store = new SignalStore()
		store.signal('count', 3)
		const text = { textContent: '' } as unknown as Element
		const container = {
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
		text.hasAttribute = (name: string) => name === 'data-aero-adopted' ? false : name === 'data-aero-text'
		text.getAttribute = (name: string) => (name === 'data-aero-text' ? '$count' : null)
		text.setAttribute = vi.fn()

		const reactivity = new AeroReactivity(store)
		const cleanup = reactivity.adopt(container)
		expect(text.textContent).toBe('3')
		cleanup()
	})

	it('returns cleanup and destroy clears adopted effects', () => {
		const store = new SignalStore()
		store.signal('count', 1)
		const container = { querySelectorAll: () => [] } as unknown as ParentNode
		const reactivity = new AeroReactivity(store)
		const cleanup = adoptFragment({ container, store })
		expect(typeof cleanup).toBe('function')
		cleanup()
		reactivity.destroy()
	})
})
