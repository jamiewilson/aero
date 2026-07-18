import { describe, expect, it } from 'vitest'
import {
	buildDirectiveAttributeNames,
	canonicalBuildDirectiveName,
	canonicalBuildDirectiveNameForFormatting,
	classifyBuildAttribute,
	formatBuildDirectiveName,
	getBuildDirectiveValidationIssue,
	isBuildDirectiveAttribute,
	isBuildDirectiveAttributeForFormatting,
	isBuildDirectiveName,
	isBuildDirectiveNameForFormatting,
	isPrefixedBuildDirectiveName,
	looksBracedDirectiveValue,
	normalizeAttributeValue,
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
			expect(formatBuildDirectiveName('else-if', 'strict')).toBe('data-aero-else-if')
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

	describe('classifyBuildAttribute', () => {
		it('classifies native HTML passthrough on host tags', () => {
			expect(classifyBuildAttribute({ tagName: 'label', attrName: 'for', rawValue: 'email' })).toEqual({
				kind: 'native-html',
				directive: 'for',
			})
			expect(classifyBuildAttribute({ tagName: 'output', attrName: 'for', rawValue: 'a b' })).toEqual({
				kind: 'native-html',
				directive: 'for',
			})
			expect(classifyBuildAttribute({ tagName: 'input', attrName: 'switch', rawValue: '' })).toEqual({
				kind: 'native-html',
				directive: 'switch',
			})
			expect(classifyBuildAttribute({ tagName: 'track', attrName: 'default', rawValue: '' })).toEqual({
				kind: 'native-html',
				directive: 'default',
			})
		})

		it('does not treat bare names as native on wrong tag, when braced, or in prefixed form', () => {
			expect(classifyBuildAttribute({ tagName: 'li', attrName: 'for', rawValue: 'const x of xs' }).kind).toBe(
				'build-directive'
			)
			expect(classifyBuildAttribute({ tagName: 'span', attrName: 'default', rawValue: '' }).kind).toBe(
				'misplaced-switch-branch'
			)
			expect(
				classifyBuildAttribute({ tagName: 'label', attrName: 'for', rawValue: '{ const x of xs }' }).kind
			).toBe('invalid-braced-for-on-native-host')
			expect(classifyBuildAttribute({ tagName: 'label', attrName: 'aero-for', rawValue: 'email' }).kind).toBe(
				'build-directive'
			)
		})

		it('classifies switch branch markers with parent context', () => {
			expect(
				classifyBuildAttribute({
					tagName: 'span',
					attrName: 'default',
					rawValue: '',
					parentHasSwitch: true,
				}).kind
			).toBe('switch-branch')
			expect(
				classifyBuildAttribute({
					tagName: 'span',
					attrName: 'default',
					rawValue: '',
					parentHasSwitch: false,
				}).kind
			).toBe('misplaced-switch-branch')
		})

		it('requires braced values for build directives', () => {
			expect(classifyBuildAttribute({ tagName: 'div', attrName: 'if', rawValue: 'ok' })).toEqual({
				kind: 'build-directive',
				directive: 'if',
				attrName: 'if',
				requiresBracedValue: true,
			})
			expect(classifyBuildAttribute({ tagName: 'div', attrName: 'if', rawValue: '{ ok }' })).toEqual({
				kind: 'build-directive',
				directive: 'if',
				attrName: 'if',
				requiresBracedValue: false,
			})
			expect(classifyBuildAttribute({ tagName: 'label', attrName: 'for', rawValue: 'email' }).kind).toBe(
				'native-html'
			)
			expect(classifyBuildAttribute({ tagName: 'label', attrName: 'aero-for', rawValue: 'email' })).toEqual({
				kind: 'build-directive',
				directive: 'for',
				attrName: 'aero-for',
				requiresBracedValue: true,
			})
		})

		it('allows bare props shorthand without requiring braces', () => {
			for (const attrName of ['props', 'aero-props', 'data-aero-props'] as const) {
				expect(
					classifyBuildAttribute({ tagName: 'meta-component', attrName, rawValue: '' })
				).toEqual({
					kind: 'build-directive',
					directive: 'props',
					attrName,
					requiresBracedValue: false,
				})
				expect(
					classifyBuildAttribute({ tagName: 'meta-component', attrName, rawValue: null })
				).toEqual({
					kind: 'build-directive',
					directive: 'props',
					attrName,
					requiresBracedValue: false,
				})
			}
			expect(
				classifyBuildAttribute({ tagName: 'div', attrName: 'props', rawValue: 'not-braced' })
			).toEqual({
				kind: 'build-directive',
				directive: 'props',
				attrName: 'props',
				requiresBracedValue: true,
			})
		})
	})

	describe('getBuildDirectiveValidationIssue', () => {
		it('returns brace messages for missing braced values', () => {
			expect(getBuildDirectiveValidationIssue({ tagName: 'div', attrName: 'if', rawValue: 'ok' })).toContain(
				'must use a braced expression'
			)
			expect(getBuildDirectiveValidationIssue({ tagName: 'li', attrName: 'for', rawValue: 'const x of xs' })).toContain(
				'must use a braced expression'
			)
			expect(
				getBuildDirectiveValidationIssue({ tagName: 'div', attrName: 'props', rawValue: 'not-braced' })
			).toContain('must use a braced expression')
		})

		it('returns null for valid native and braced directives', () => {
			expect(getBuildDirectiveValidationIssue({ tagName: 'label', attrName: 'for', rawValue: 'email' })).toBeNull()
			expect(getBuildDirectiveValidationIssue({ tagName: 'div', attrName: 'if', rawValue: '{ ok }' })).toBeNull()
		})

		it('returns null for bare props shorthand', () => {
			expect(
				getBuildDirectiveValidationIssue({ tagName: 'meta-component', attrName: 'props', rawValue: '' })
			).toBeNull()
			expect(
				getBuildDirectiveValidationIssue({ tagName: 'meta-component', attrName: 'props', rawValue: null })
			).toBeNull()
			expect(
				getBuildDirectiveValidationIssue({
					tagName: 'meta-component',
					attrName: 'aero-props',
					rawValue: '',
				})
			).toBeNull()
			expect(
				getBuildDirectiveValidationIssue({
					tagName: 'meta-component',
					attrName: 'data-aero-props',
					rawValue: '',
				})
			).toBeNull()
		})

		it('flags braced for on native host tags', () => {
			expect(
				getBuildDirectiveValidationIssue({ tagName: 'label', attrName: 'for', rawValue: '{ id }' })
			).toContain('native IDREF')
		})
	})
})
