import { describe, expect, it } from 'vitest'
import {
	REACTIVE_BIND_DISPATCH_ORDER,
	classifyReactiveAttribute,
} from '../../reactive-attribute-classification'

describe('reactive-attribute-classification', () => {
	it('documents dispatch order for attribute-binding refactor', () => {
		expect(REACTIVE_BIND_DISPATCH_ORDER).toEqual([
			'event-directive',
			'runtime-text',
			'runtime-busy',
			'runtime-show',
			'runtime-html',
			'runtime-class',
			'form-model',
			'idl-property',
			'attribute-bind',
		])
	})

	describe('classifyReactiveAttribute', () => {
		it('classifies event directives before runtime shorthands', () => {
			expect(
				classifyReactiveAttribute({
					tagName: 'button',
					attrName: 'on:click',
					rawValue: '{ submit() }',
				}).kind
			).toBe('event-directive')
		})

		it('classifies runtime shorthands', () => {
			expect(
				classifyReactiveAttribute({ tagName: 'div', attrName: 'show', rawValue: '{ open }' }).kind
			).toBe('runtime-show')
			expect(
				classifyReactiveAttribute({ tagName: 'span', attrName: 'text', rawValue: '{ label }' }).kind
			).toBe('runtime-text')
			expect(
				classifyReactiveAttribute({
					tagName: 'button',
					attrName: 'class:is-active',
					rawValue: '{ active }',
				}).kind
			).toBe('runtime-class')
		})

		it('classifies form model on form controls before idl and attribute bind', () => {
			const state = new Set(['email'])
			expect(
				classifyReactiveAttribute({
					tagName: 'input',
					attrName: 'value',
					rawValue: '{ email }',
					inputType: 'email',
					reactiveEnabled: true,
					stateBindingNames: state,
				})
			).toEqual({ kind: 'form-model', modelKind: 'value', readonly: false })
		})

		it('classifies idl property whitelist before default attribute bind', () => {
			const state = new Set(['saving'])
			expect(
				classifyReactiveAttribute({
					tagName: 'button',
					attrName: 'disabled',
					rawValue: '{ saving }',
					reactiveEnabled: true,
					stateBindingNames: state,
				})
			).toEqual({
				kind: 'idl-property',
				bareName: 'disabled',
				propertyName: 'disabled',
			})
		})

		it('defaults braced state refs to attribute bind', () => {
			const state = new Set(['theme'])
			expect(
				classifyReactiveAttribute({
					tagName: 'html',
					attrName: 'data-theme',
					rawValue: '{ theme }',
					reactiveEnabled: true,
					stateBindingNames: state,
				})
			).toEqual({ kind: 'attribute-bind', bareName: 'data-theme' })
		})

		it('returns not-applicable for third-party directive attrs', () => {
			expect(
				classifyReactiveAttribute({
					tagName: 'div',
					attrName: 'x-show',
					rawValue: '{ open }',
					reactiveEnabled: true,
					stateBindingNames: new Set(['open']),
				}).kind
			).toBe('not-applicable')
		})

		it('returns not-applicable without reactiveEnabled', () => {
			expect(
				classifyReactiveAttribute({
					tagName: 'html',
					attrName: 'data-theme',
					rawValue: '{ theme }',
					reactiveEnabled: false,
					stateBindingNames: new Set(['theme']),
				}).kind
			).toBe('not-applicable')
		})
	})
})
