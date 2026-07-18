import { describe, expect, it } from 'vitest'
import {
	formatAuthorAttributeName,
	isPrefixableAuthorAttribute,
	listPrefixableAuthorAttributeDescriptors,
	parseBindAttributePropName,
	resolveAuthorAttributeForFormatting,
	scriptIsAttributeNames,
} from '../author-attribute-format'

describe('author-attribute-format', () => {
	it('formats build / runtime / script / event / class / bind by mode', () => {
		const cases: Array<{
			none: string
			aero: string
			dataAero: string
		}> = [
			{ none: 'if', aero: 'aero-if', dataAero: 'data-aero-if' },
			{ none: 'props', aero: 'aero-props', dataAero: 'data-aero-props' },
			{ none: 'key', aero: 'aero-key', dataAero: 'data-aero-key' },
			{ none: 'show', aero: 'aero-show', dataAero: 'data-aero-show' },
			{ none: 'text', aero: 'aero-text', dataAero: 'data-aero-text' },
			{ none: 'is:build', aero: 'aero-is:build', dataAero: 'data-aero-is-build' },
			{ none: 'on:click', aero: 'aero-on:click', dataAero: 'data-aero-on-click' },
			{
				none: 'on:submit.prevent',
				aero: 'aero-on:submit.prevent',
				dataAero: 'data-aero-on-submit-prevent',
			},
			{ none: 'class:is-active', aero: 'aero-class:is-active', dataAero: 'data-aero-class-is-active' },
			{ none: 'bind:count', aero: 'aero-bind:count', dataAero: 'data-aero-bind-count' },
		]

		for (const c of cases) {
			const canonical = resolveAuthorAttributeForFormatting(c.none)
			expect(canonical, c.none).not.toBeNull()
			expect(formatAuthorAttributeName(canonical!, 'none')).toBe(c.none)
			expect(formatAuthorAttributeName(canonical!, 'aero')).toBe(c.aero)
			expect(formatAuthorAttributeName(canonical!, 'strict')).toBe(c.dataAero)
			expect(resolveAuthorAttributeForFormatting(c.aero)).toEqual(canonical)
			expect(resolveAuthorAttributeForFormatting(c.dataAero)).toEqual(canonical)
		}
	})

	it('does not treat emit-only markers or unimplemented names as author attrs', () => {
		expect(resolveAuthorAttributeForFormatting('data-aero-event')).toBeNull()
		expect(resolveAuthorAttributeForFormatting('data-aero-bind')).toBeNull()
		expect(resolveAuthorAttributeForFormatting('data-aero-model-value')).toBeNull()
		expect(resolveAuthorAttributeForFormatting('state')).toBeNull()
		expect(resolveAuthorAttributeForFormatting('computed:total')).toBeNull()
	})

	it('skips native HTML collisions and non-script is:*', () => {
		expect(
			isPrefixableAuthorAttribute({
				tagName: 'label',
				attrName: 'for',
				rawValue: '"email"',
			})
		).toBe(false)
		expect(
			isPrefixableAuthorAttribute({
				tagName: 'div',
				attrName: 'is:build',
				rawValue: null,
			})
		).toBe(false)
		expect(
			isPrefixableAuthorAttribute({
				tagName: 'script',
				attrName: 'is:build',
				rawValue: null,
			})
		).toBe(true)
	})

	it('requires braced values for runtime and events', () => {
		expect(
			isPrefixableAuthorAttribute({ tagName: 'div', attrName: 'show', rawValue: '"{ open }"' })
		).toBe(true)
		expect(
			isPrefixableAuthorAttribute({ tagName: 'div', attrName: 'show', rawValue: '"yes"' })
		).toBe(false)
		expect(
			isPrefixableAuthorAttribute({
				tagName: 'button',
				attrName: 'on:click',
				rawValue: '"{ count++ }"',
			})
		).toBe(true)
	})

	it('lists script is attribute aliases', () => {
		expect(scriptIsAttributeNames('build')).toContain('is:build')
		expect(scriptIsAttributeNames('build')).toContain('aero-is:build')
		expect(scriptIsAttributeNames('build')).toContain('data-aero-is-build')
	})

	it('parses bind prop names across prefix modes', () => {
		expect(parseBindAttributePropName('bind:count')).toBe('count')
		expect(parseBindAttributePropName('aero-bind:count')).toBe('count')
		expect(parseBindAttributePropName('data-aero-bind-count')).toBe('count')
	})

	it('round-trips every listed prefixable descriptor', () => {
		for (const desc of listPrefixableAuthorAttributeDescriptors()) {
			const canonical = resolveAuthorAttributeForFormatting(desc.exampleNone)
			expect(canonical, desc.id).not.toBeNull()
			for (const mode of ['none', 'aero', 'strict'] as const) {
				const formatted = formatAuthorAttributeName(canonical!, mode)
				expect(resolveAuthorAttributeForFormatting(formatted)).toEqual(canonical)
			}
		}
	})
})
