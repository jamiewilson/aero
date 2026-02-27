/**
 * Unit tests for compiler/directive-attributes.ts: isDirectiveAttr with default
 * and custom config (Alpine/HTMX/Vue-style prefixes).
 */

import { describe, it, expect } from 'vitest'
import { isDirectiveAttr, DEFAULT_DIRECTIVE_PREFIXES } from '../directive-attributes'

describe('isDirectiveAttr with default config', () => {
	it('returns true for Alpine x- prefix', () => {
		expect(isDirectiveAttr('x-data')).toBe(true)
		expect(isDirectiveAttr('x-model')).toBe(true)
		expect(isDirectiveAttr('x-show')).toBe(true)
	})

	it('returns true for @ prefix (Alpine/Vue events)', () => {
		expect(isDirectiveAttr('@click')).toBe(true)
		expect(isDirectiveAttr('@submit')).toBe(true)
	})

	it('returns true for : prefix (Alpine/Vue bindings)', () => {
		expect(isDirectiveAttr(':disabled')).toBe(true)
		expect(isDirectiveAttr(':class')).toBe(true)
	})

	it('returns true for . prefix (Alpine modifiers)', () => {
		expect(isDirectiveAttr('.prevent')).toBe(true)
	})

	it('returns false for normal and Aero directive attributes', () => {
		expect(isDirectiveAttr('href')).toBe(false)
		expect(isDirectiveAttr('class')).toBe(false)
		expect(isDirectiveAttr('data-each')).toBe(false)
		expect(isDirectiveAttr('data-if')).toBe(false)
		expect(isDirectiveAttr('data-props')).toBe(false)
	})

	it('returns false for hx- when using default config', () => {
		expect(isDirectiveAttr('hx-post')).toBe(false)
	})
})

describe('DEFAULT_DIRECTIVE_PREFIXES', () => {
	it('includes Alpine and shorthand prefixes', () => {
		expect(DEFAULT_DIRECTIVE_PREFIXES).toContain('x-')
		expect(DEFAULT_DIRECTIVE_PREFIXES).toContain('@')
		expect(DEFAULT_DIRECTIVE_PREFIXES).toContain(':')
		expect(DEFAULT_DIRECTIVE_PREFIXES).toContain('.')
	})
})

describe('isDirectiveAttr with custom config', () => {
	it('accepts custom prefixes', () => {
		expect(isDirectiveAttr('hx-post', { prefixes: ['hx-'] })).toBe(true)
		expect(isDirectiveAttr('hx-get', { prefixes: ['hx-'] })).toBe(true)
		expect(isDirectiveAttr('x-data', { prefixes: ['hx-'] })).toBe(false)
	})

	it('accepts multiple custom prefixes', () => {
		expect(
			isDirectiveAttr('v-model', { prefixes: ['x-', 'hx-', 'v-'] }),
		).toBe(true)
		expect(
			isDirectiveAttr('hx-post', { prefixes: ['x-', 'hx-', 'v-'] }),
		).toBe(true)
	})

	it('accepts exactNames for full attribute names', () => {
		expect(
			isDirectiveAttr('foo', { prefixes: [], exactNames: ['foo'] }),
		).toBe(true)
		expect(
			isDirectiveAttr('bar', { prefixes: [], exactNames: ['foo'] }),
		).toBe(false)
	})
})
