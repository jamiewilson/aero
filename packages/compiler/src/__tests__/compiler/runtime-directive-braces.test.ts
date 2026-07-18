import { describe, expect, it } from 'vitest'
import {
	attributeHasExplicitValueInSource,
	getRuntimeDirectiveBraceIssue,
	resolveRuntimeDirectiveHasValue,
	runtimeDirectiveRequiresBracedValue,
} from '../../runtime-directive-braces'

describe('runtime-directive-braces', () => {
	describe('resolveRuntimeDirectiveHasValue / attributeHasExplicitValueInSource', () => {
		it('treats non-empty values as explicit', () => {
			expect(resolveRuntimeDirectiveHasValue('class:is-active', 'true')).toBe(true)
			expect(resolveRuntimeDirectiveHasValue('class:is-active', '{ isActive }')).toBe(true)
		})

		it('treats bare attrs as non-explicit without `=` in source', () => {
			expect(resolveRuntimeDirectiveHasValue('class:is-active', '', '<div class:is-active>')).toBe(
				false
			)
			expect(attributeHasExplicitValueInSource('<div class:is-active>', 'class:is-active')).toBe(
				false
			)
		})

		it('treats empty quoted values as explicit when `=` is in source', () => {
			expect(
				resolveRuntimeDirectiveHasValue('class:is-active', '', '<div class:is-active="">')
			).toBe(true)
			expect(
				attributeHasExplicitValueInSource('<div class:is-active="">', 'class:is-active')
			).toBe(true)
		})
	})

	describe('runtimeDirectiveRequiresBracedValue', () => {
		it('always requires braces for show/html/busy', () => {
			expect(runtimeDirectiveRequiresBracedValue('show', false)).toBe(true)
			expect(runtimeDirectiveRequiresBracedValue('html', true)).toBe(true)
			expect(runtimeDirectiveRequiresBracedValue('busy', false)).toBe(true)
		})

		it('requires braces for class:* only when hasValue', () => {
			expect(runtimeDirectiveRequiresBracedValue('class:is-active', false)).toBe(false)
			expect(runtimeDirectiveRequiresBracedValue('class:is-active', true)).toBe(true)
		})
	})

	describe('getRuntimeDirectiveBraceIssue', () => {
		it('flags non-braced class value', () => {
			expect(
				getRuntimeDirectiveBraceIssue({
					attrName: 'class:is-active',
					rawValue: 'true',
					hasValue: true,
				})
			).toContain('must use a braced expression')
		})

		it('flags empty class value', () => {
			expect(
				getRuntimeDirectiveBraceIssue({
					attrName: 'class:is-active',
					rawValue: '',
					hasValue: true,
				})
			).toContain('class:is-active')
		})

		it('allows bare class shorthand', () => {
			expect(
				getRuntimeDirectiveBraceIssue({
					attrName: 'class:is-active',
					rawValue: '',
					hasValue: false,
				})
			).toBeNull()
		})

		it('allows braced class value', () => {
			expect(
				getRuntimeDirectiveBraceIssue({
					attrName: 'class:is-active',
					rawValue: '{ isActive }',
					hasValue: true,
				})
			).toBeNull()
		})

		it('flags non-braced show', () => {
			expect(
				getRuntimeDirectiveBraceIssue({
					attrName: 'show',
					rawValue: 'x',
					hasValue: true,
				})
			).toContain('Directive `show`')
		})

		it('flags non-braced html', () => {
			expect(
				getRuntimeDirectiveBraceIssue({
					attrName: 'html',
					rawValue: 'x',
					hasValue: true,
				})
			).toContain('Directive `html`')
		})
	})
})
