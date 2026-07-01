import { describe, expect, it } from 'vitest'
import { coerceAttributeValue, formatAttributeBind } from '../bindings/coerce-attribute-value'
import { bindAttribute } from '../bindings/attribute'
import { bindProperty } from '../bindings/property'

describe('coerceAttributeValue', () => {
	it('boolean data-visible: true → presence', () => {
		expect(coerceAttributeValue('data-visible', true)).toEqual({ action: 'set', value: '' })
	})

	it('boolean data-visible: false → remove', () => {
		expect(coerceAttributeValue('data-visible', false)).toEqual({ action: 'remove' })
	})

	it('boolean is-even: true → presence (same as data-*)', () => {
		expect(coerceAttributeValue('is-even', true)).toEqual({ action: 'set', value: '' })
	})

	it('boolean is-even: false → remove', () => {
		expect(coerceAttributeValue('is-even', false)).toEqual({ action: 'remove' })
	})

	it('boolean href: stringify (no hyphen flag semantics)', () => {
		expect(coerceAttributeValue('href', true)).toEqual({ action: 'set', value: 'true' })
	})

	it('string data-theme: "dark" → set', () => {
		expect(coerceAttributeValue('data-theme', 'dark')).toEqual({ action: 'set', value: 'dark' })
	})

	it('aria-expanded: false → "false" not remove', () => {
		expect(coerceAttributeValue('aria-expanded', false)).toEqual({ action: 'set', value: 'false' })
	})

	it('href empty string → remove', () => {
		expect(coerceAttributeValue('href', '')).toEqual({ action: 'remove' })
	})
})

describe('formatAttributeBind', () => {
	it('boolean is-even false → empty fragment', () => {
		expect(formatAttributeBind('is-even', false)).toBe('')
	})

	it('boolean is-even true → presence with leading space', () => {
		expect(formatAttributeBind('is-even', true)).toBe(' is-even=""')
	})

	it('string data-theme → quoted value', () => {
		expect(formatAttributeBind('data-theme', 'dark')).toBe(' data-theme="dark"')
	})

	it('aria-expanded false → explicit false string', () => {
		expect(formatAttributeBind('aria-expanded', false)).toBe(' aria-expanded="false"')
	})
})

describe('bindAttribute', () => {
	it('syncs data-theme via setAttribute', () => {
		const attrs = new Map<string, string>()
		const target = {
			setAttribute(name: string, value: string) {
				attrs.set(name, value)
			},
			removeAttribute(name: string) {
				attrs.delete(name)
			},
		} as unknown as Element
		let theme = 'dark'
		const cleanup = bindAttribute(target, 'data-theme', () => theme)
		expect(attrs.get('data-theme')).toBe('dark')
		theme = 'light'
		cleanup()
		bindAttribute(target, 'data-theme', () => theme)
		expect(attrs.get('data-theme')).toBe('light')
	})

	it('boolean data-visible: false removes attribute', () => {
		const attrs = new Map<string, string>([['data-visible', '']])
		const target = {
			setAttribute(name: string, value: string) {
				attrs.set(name, value)
			},
			removeAttribute(name: string) {
				attrs.delete(name)
			},
		} as unknown as Element
		let visible = true
		const cleanup = bindAttribute(target, 'data-visible', () => visible)
		expect(attrs.has('data-visible')).toBe(true)
		visible = false
		cleanup()
		bindAttribute(target, 'data-visible', () => visible)
		expect(attrs.has('data-visible')).toBe(false)
	})

	it('boolean is-even: false removes attribute', () => {
		const attrs = new Map<string, string>([['is-even', '']])
		const target = {
			setAttribute(name: string, value: string) {
				attrs.set(name, value)
			},
			removeAttribute(name: string) {
				attrs.delete(name)
			},
		} as unknown as Element
		let isEven = true
		const cleanup = bindAttribute(target, 'is-even', () => isEven)
		expect(attrs.has('is-even')).toBe(true)
		isEven = false
		cleanup()
		bindAttribute(target, 'is-even', () => isEven)
		expect(attrs.has('is-even')).toBe(false)
	})

	it('coexists with bindProperty on same element', () => {
		const attrs = new Map<string, string>()
		const target = {
			disabled: false,
			setAttribute(name: string, value: string) {
				attrs.set(name, value)
			},
			removeAttribute(name: string) {
				attrs.delete(name)
			},
		} as unknown as HTMLButtonElement & Element
		let saving = false
		let label = 'Save'
		bindProperty(target, 'disabled', () => saving)
		const cleanupBusy = bindAttribute(target, 'data-saving', () => saving)
		const cleanupLabel = bindAttribute(target, 'data-label', () => label)
		expect(target.disabled).toBe(false)
		expect(attrs.get('data-label')).toBe('Save')
		saving = true
		cleanupBusy()
		cleanupLabel()
		bindProperty(target, 'disabled', () => saving)
		bindAttribute(target, 'data-saving', () => saving)
		bindAttribute(target, 'data-label', () => label)
		expect(target.disabled).toBe(true)
		expect(attrs.get('data-saving')).toBe('')
	})
})
