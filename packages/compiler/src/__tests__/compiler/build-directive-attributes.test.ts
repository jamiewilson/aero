import { describe, expect, it } from 'vitest'
import {
	buildDirectiveAttributeNames,
	canonicalBuildDirectiveName,
	canonicalBuildDirectiveNameForFormatting,
	formatBuildDirectiveName,
	isBuildDirectiveAttribute,
	isBuildDirectiveAttributeForFormatting,
	isBuildDirectiveName,
	isBuildDirectiveNameForFormatting,
	isNativeBareAttribute,
	isPrefixedBuildDirectiveName,
	looksBracedDirectiveValue,
	normalizeAttributeValue,
	requiresBracedDirectiveValue,
	resolveBuildDirectiveName,
	resolveBuildDirectiveNameForFormatting,
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

	describe('formatBuildDirectiveName / buildDirectiveAttributeNames', () => {
		it('formats bare, aero, and data-aero names', () => {
			expect(formatBuildDirectiveName('if', 'none')).toBe('if')
			expect(formatBuildDirectiveName('if', 'aero')).toBe('aero-if')
			expect(formatBuildDirectiveName('else-if', 'data-aero')).toBe('data-aero-else-if')
		})

		it('lists all supported attribute names for a directive', () => {
			expect(buildDirectiveAttributeNames('for')).toEqual(['for', 'aero-for', 'data-aero-for'])
		})
	})

	describe('resolveBuildDirectiveName / isBuildDirectiveName', () => {
		it('accepts bare and aero / data-aero prefixed names', () => {
			expect(resolveBuildDirectiveName('if')).toBe('if')
			expect(resolveBuildDirectiveName('aero-for')).toBe('for')
			expect(resolveBuildDirectiveName('data-aero-if')).toBe('if')
			expect(isBuildDirectiveName('aero-props')).toBe(true)
			expect(canonicalBuildDirectiveName('data-aero-if')).toBe('if')
		})

		it('rejects legacy data- prefixed names', () => {
			expect(resolveBuildDirectiveName('data-for')).toBeNull()
			expect(isBuildDirectiveName('data-if')).toBe(false)
			expect(() => canonicalBuildDirectiveName('data-if')).toThrow(/Not a build directive/)
		})

		it('rejects non-directive names', () => {
			expect(isBuildDirectiveName('href')).toBe(false)
			expect(() => canonicalBuildDirectiveName('href')).toThrow(/Not a build directive/)
		})

		it('accepts legacy data- names for formatting only', () => {
			expect(resolveBuildDirectiveNameForFormatting('data-for')).toBe('for')
			expect(isBuildDirectiveNameForFormatting('data-if')).toBe(true)
			expect(canonicalBuildDirectiveNameForFormatting('data-props')).toBe('props')
		})
	})

	describe('isPrefixedBuildDirectiveName', () => {
		it('returns true for prefixed forms only', () => {
			expect(isPrefixedBuildDirectiveName('aero-if')).toBe(true)
			expect(isPrefixedBuildDirectiveName('data-aero-for')).toBe(true)
			expect(isPrefixedBuildDirectiveName('if')).toBe(false)
		})
	})

	describe('isBuildDirectiveAttribute', () => {
		it('treats braced for as build directive but not plain for', () => {
			expect(isBuildDirectiveAttribute('for', '"{ const x of xs }"')).toBe(true)
			expect(isBuildDirectiveAttribute('for', '"email"')).toBe(false)
			expect(isBuildDirectiveAttribute('aero-for', '"{ const x of xs }"')).toBe(true)
		})

		it('treats else and default as build directives without braced value', () => {
			expect(isBuildDirectiveAttribute('else', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('aero-else', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('default', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('data-aero-default', '""')).toBe(true)
		})

		it('treats case with string literal or braced expression as build directive', () => {
			expect(isBuildDirectiveAttribute('case', '"SignedOut"')).toBe(true)
			expect(isBuildDirectiveAttribute('aero-case', '"SignedOut"')).toBe(true)
			expect(isBuildDirectiveAttribute('case', '"{ AuthState.SignedIn }"')).toBe(true)
		})

		it('treats bare props as build directive', () => {
			expect(isBuildDirectiveAttribute('props', '""')).toBe(true)
			expect(isBuildDirectiveAttribute('aero-props', '""')).toBe(true)
		})

		it('accepts legacy data- names for formatting only', () => {
			expect(isBuildDirectiveAttribute('data-for', '"{ const x of xs }"')).toBe(false)
			expect(isBuildDirectiveAttributeForFormatting('data-for', '"{ const x of xs }"')).toBe(true)
		})
	})

	describe('isNativeBareAttribute', () => {
		it('treats native bare attributes on their host tags', () => {
			expect(isNativeBareAttribute('label', 'for', 'email')).toBe(true)
			expect(isNativeBareAttribute('output', 'for', 'a b')).toBe(true)
			expect(isNativeBareAttribute('input', 'switch', '')).toBe(true)
			expect(isNativeBareAttribute('track', 'default', '')).toBe(true)
		})

		it('does not treat bare names as native on wrong tag, when braced, or in prefixed form', () => {
			expect(isNativeBareAttribute('li', 'for', 'const x of xs')).toBe(false)
			expect(isNativeBareAttribute('span', 'default', '')).toBe(false)
			expect(isNativeBareAttribute('label', 'for', '{ const x of xs }')).toBe(false)
			expect(isNativeBareAttribute('track', 'aero-default', '')).toBe(false)
			expect(isNativeBareAttribute('label', 'aero-for', 'email')).toBe(false)
			expect(isNativeBareAttribute('label', 'data-aero-for', 'email')).toBe(false)
		})
	})

	describe('requiresBracedDirectiveValue', () => {
		it('requires braces for braced-value directives', () => {
			expect(requiresBracedDirectiveValue('if', 'ok')).toBe(true)
			expect(requiresBracedDirectiveValue('aero-if', 'ok')).toBe(true)
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

		it('never exempts explicit prefixed form on native tags', () => {
			expect(requiresBracedDirectiveValue('aero-for', 'email', 'label')).toBe(true)
			expect(requiresBracedDirectiveValue('data-aero-for', 'email', 'label')).toBe(true)
		})

		it('does not apply to else, default, case, or switch', () => {
			expect(requiresBracedDirectiveValue('else', '')).toBe(false)
			expect(requiresBracedDirectiveValue('default', '')).toBe(false)
			expect(requiresBracedDirectiveValue('case', 'active')).toBe(false)
			expect(requiresBracedDirectiveValue('switch', '{ x }')).toBe(false)
		})
	})
})
