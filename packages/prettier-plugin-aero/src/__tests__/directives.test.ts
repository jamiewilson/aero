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

	it('limits self-closing preference to *-component tags', () => {
		expect(isSelfClosingComponentTag('nav-component')).toBe(true)
		expect(isSelfClosingComponentTag('site-layout')).toBe(false)
		expect(isSelfClosingComponentTag('div')).toBe(false)
	})
})
