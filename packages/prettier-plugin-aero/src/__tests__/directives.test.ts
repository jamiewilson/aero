import { describe, expect, it } from 'vitest'
import {
	isBuildDirectiveAttribute,
	isSelfClosingComponentTag,
} from '../directives.js'

describe('directives', () => {
	it('treats braced for as build directive but not plain for', () => {
		expect(isBuildDirectiveAttribute('for', '"{ const x of xs }"')).toBe(true)
		expect(isBuildDirectiveAttribute('for', '"email"')).toBe(false)
		expect(isBuildDirectiveAttribute('data-for', '"{ const x of xs }"')).toBe(true)
	})

	it('treats else as build directive without braced value', () => {
		expect(isBuildDirectiveAttribute('else', '""')).toBe(true)
		expect(isBuildDirectiveAttribute('data-else', '""')).toBe(true)
	})

	it('treats default as build directive without braced value', () => {
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

	it('limits self-closing preference to *-component tags', () => {
		expect(isSelfClosingComponentTag('nav-component')).toBe(true)
		expect(isSelfClosingComponentTag('site-layout')).toBe(false)
		expect(isSelfClosingComponentTag('div')).toBe(false)
	})
})
