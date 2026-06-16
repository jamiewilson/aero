import { describe, expect, it } from 'vitest'
import {
	canonicalBuildDirectiveName,
	isBuildDirectiveAttribute,
	isBuildDirectiveName,
	isNativeBareAttribute,
	looksBracedDirectiveValue,
	normalizeAttributeValue,
	requiresBracedDirectiveValue,
} from '../../build-directive-attributes'

describe('build-directive-attributes', () => {
	describe('normalizeAttributeValue / looksBracedDirectiveValue', () => {
		it('strips quote wrappers', () => {
			expect(normalizeAttributeValue('"email"')).toBe('email')
			expect(normalizeAttributeValue("'x'")).toBe('x')
			expect(normalizeAttributeValue('{ ok }')).toBe('{ ok }')
		})

		it('detects braced directive values', () => {
			expect(looksBracedDirectiveValue('{ ok }')).toBe(true)
			expect(looksBracedDirectiveValue('"email"')).toBe(false)
			expect(looksBracedDirectiveValue('')).toBe(false)
		})
	})

	describe('isBuildDirectiveName / canonicalBuildDirectiveName', () => {
		it('accepts bare and data- prefixed names', () => {
			expect(isBuildDirectiveName('if')).toBe(true)
			expect(isBuildDirectiveName('data-for')).toBe(true)
			expect(canonicalBuildDirectiveName('data-if')).toBe('if')
		})

		it('rejects non-directive names', () => {
			expect(isBuildDirectiveName('href')).toBe(false)
			expect(() => canonicalBuildDirectiveName('href')).toThrow(/Not a build directive/)
		})
	})

	describe('isBuildDirectiveAttribute', () => {
		it('treats braced for as build directive but not plain for', () => {
			expect(isBuildDirectiveAttribute('for', '"{ const x of xs }"')).toBe(true)
			expect(isBuildDirectiveAttribute('for', '"email"')).toBe(false)
			expect(isBuildDirectiveAttribute('data-for', '"{ const x of xs }"')).toBe(true)
		})

		it('treats else and default as build directives without braced value', () => {
			expect(isBuildDirectiveAttribute('else', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('data-else', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('default', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('data-default', '""')).toBe(true)
		})

		it('treats case with string literal or braced expression as build directive', () => {
			expect(isBuildDirectiveAttribute('case', '"SignedOut"')).toBe(true)
			expect(isBuildDirectiveAttribute('data-case', '"SignedOut"')).toBe(true)
			expect(isBuildDirectiveAttribute('case', '"{ AuthState.SignedIn }"')).toBe(true)
		})

		it('treats bare props as build directive', () => {
			expect(isBuildDirectiveAttribute('props', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('data-props', '""')).toBe(true)
		})
	})

	describe('isNativeBareAttribute', () => {
		it('treats native bare attributes on their host tags', () => {
			expect(isNativeBareAttribute('label', 'for', 'email')).toBe(true)
			expect(isNativeBareAttribute('output', 'for', 'a b')).toBe(true)
			expect(isNativeBareAttribute('input', 'switch', '')).toBe(true)
			expect(isNativeBareAttribute('track', 'default', '')).toBe(true)
		})

		it('does not treat bare names as native on wrong tag, when braced, or in data- form', () => {
			expect(isNativeBareAttribute('li', 'for', 'const x of xs')).toBe(false)
			expect(isNativeBareAttribute('span', 'default', '')).toBe(false)
			expect(isNativeBareAttribute('label', 'for', '{ const x of xs }')).toBe(false)
			expect(isNativeBareAttribute('track', 'data-default', '')).toBe(false)
			expect(isNativeBareAttribute('label', 'data-for', 'email')).toBe(false)
		})
	})

	describe('requiresBracedDirectiveValue', () => {
		it('requires braces for braced-value directives', () => {
			expect(requiresBracedDirectiveValue('if', 'ok')).toBe(true)
			expect(requiresBracedDirectiveValue('data-if', 'ok')).toBe(true)
			expect(requiresBracedDirectiveValue('for', 'const x of xs', 'li')).toBe(true)
			expect(requiresBracedDirectiveValue('props', 'title')).toBe(true)
		})

		it('passes when value is braced', () => {
			expect(requiresBracedDirectiveValue('if', '{ ok }')).toBe(false)
			expect(requiresBracedDirectiveValue('for', '{ const x of xs }', 'li')).toBe(false)
		})

		it('exempts native HTML attributes on their host tags', () => {
			expect(requiresBracedDirectiveValue('for', 'email', 'label')).toBe(false)
			expect(requiresBracedDirectiveValue('for', 'a b', 'output')).toBe(false)
		})

		it('never exempts explicit data- form on native tags', () => {
			expect(requiresBracedDirectiveValue('data-for', 'email', 'label')).toBe(true)
		})

		it('does not apply to else, default, case, or switch', () => {
			expect(requiresBracedDirectiveValue('else', '')).toBe(false)
			expect(requiresBracedDirectiveValue('default', '')).toBe(false)
			expect(requiresBracedDirectiveValue('case', 'active')).toBe(false)
			expect(requiresBracedDirectiveValue('switch', '{ x }')).toBe(false)
		})
	})
})
