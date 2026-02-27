/**
 * Unit tests for @aerobuilt/interpolation: tokenizeCurlyInterpolation and compileInterpolationFromSegments.
 *
 * Covers: nested braces, strings containing } or ", comments containing braces,
 * attribute mode ({{ / }} as literal), and segment→compiled string output.
 */

import { describe, it, expect } from 'vitest'
import {
	tokenizeCurlyInterpolation,
	compileInterpolationFromSegments,
	type Segment,
} from '../index'

describe('tokenizeCurlyInterpolation (text mode)', () => {
	it('returns single literal segment for string with no braces', () => {
		const segments = tokenizeCurlyInterpolation('hello world', { attributeMode: false })
		expect(segments).toEqual([
			{ kind: 'literal', start: 0, end: 11, value: 'hello world' },
		])
	})

	it('parses simple interpolation', () => {
		const segments = tokenizeCurlyInterpolation('hello {name}', { attributeMode: false })
		expect(segments).toEqual([
			{ kind: 'literal', start: 0, end: 6, value: 'hello ' },
			{ kind: 'interpolation', start: 6, end: 12, expression: 'name' },
		])
	})

	it('parses nested braces as single interpolation', () => {
		const input = '{ a({ b: 1 }) }'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: false })
		expect(segments).toHaveLength(1)
		expect(segments[0]).toEqual({
			kind: 'interpolation',
			start: 0,
			end: input.length,
			expression: ' a({ b: 1 }) ',
		})
	})

	it('string containing } does not end interpolation', () => {
		const input = '{ "}" }'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: false })
		expect(segments).toHaveLength(1)
		expect(segments[0].kind).toBe('interpolation')
		expect((segments[0] as { expression: string }).expression).toContain('"}"')
	})

	it('string containing double quote', () => {
		const input = "{ '\"' }"
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: false })
		expect(segments).toHaveLength(1)
		expect(segments[0].kind).toBe('interpolation')
		expect((segments[0] as { expression: string }).expression.trim()).toContain("'\"'")
	})

	it('comment containing braces does not end interpolation', () => {
		const input = '{ a /* } */ }'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: false })
		expect(segments).toHaveLength(1)
		expect(segments[0].kind).toBe('interpolation')
		expect((segments[0] as { expression: string }).expression).toContain('a /* } */')
	})

	it('line comment containing }', () => {
		const input = '{ x // }\n }'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: false })
		expect(segments).toHaveLength(1)
		expect(segments[0].kind).toBe('interpolation')
	})

	it('multiple interpolations', () => {
		const segments = tokenizeCurlyInterpolation('{a} and {b}', { attributeMode: false })
		expect(segments).toEqual([
			{ kind: 'interpolation', start: 0, end: 3, expression: 'a' },
			{ kind: 'literal', start: 3, end: 8, value: ' and ' },
			{ kind: 'interpolation', start: 8, end: 11, expression: 'b' },
		])
	})

	it('backslash escape in double-quoted string', () => {
		const input = '{ "\\" }'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: false })
		expect(segments).toHaveLength(1)
		expect(segments[0].kind).toBe('interpolation')
	})
})

describe('tokenizeCurlyInterpolation (attribute mode)', () => {
	it('{{ and }} produce literal { and }', () => {
		const input = '{{ literal }}'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: true })
		expect(segments).toEqual([
			{ kind: 'literal', start: 0, end: 2, value: '{' },
			{ kind: 'literal', start: 2, end: 11, value: ' literal ' },
			{ kind: 'literal', start: 11, end: 13, value: '}' },
		])
	})

	it('value="{{ literal }}" → literal output { literal }', () => {
		const input = '{{ literal }}'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: true })
		const compiled = compileInterpolationFromSegments(segments)
		expect(compiled).toBe('{ literal }')
	})

	it('mixed: value="{{ {expr} }}" → literal {, interpolation expr, literal }', () => {
		const input = '{{ {expr} }}'
		const segments = tokenizeCurlyInterpolation(input, { attributeMode: true })
		expect(segments).toEqual([
			{ kind: 'literal', start: 0, end: 2, value: '{' },
			{ kind: 'literal', start: 2, end: 3, value: ' ' },
			{ kind: 'interpolation', start: 3, end: 9, expression: 'expr' },
			{ kind: 'literal', start: 9, end: 10, value: ' ' },
			{ kind: 'literal', start: 10, end: 12, value: '}' },
		])
		const compiled = compileInterpolationFromSegments(segments)
		expect(compiled).toBe('{ ${expr} }')
	})

	it('single { without second { starts interpolation in attribute mode', () => {
		const segments = tokenizeCurlyInterpolation('{name}', { attributeMode: true })
		expect(segments).toEqual([
			{ kind: 'interpolation', start: 0, end: 6, expression: 'name' },
		])
	})
})

describe('compileInterpolationFromSegments', () => {
	it('literals only → unchanged (no backticks)', () => {
		const segments: Segment[] = [
			{ kind: 'literal', start: 0, end: 5, value: 'hello' },
		]
		expect(compileInterpolationFromSegments(segments)).toBe('hello')
	})

	it('escapes backticks in literal segments', () => {
		const segments: Segment[] = [
			{ kind: 'literal', start: 0, end: 7, value: '`world`' },
		]
		expect(compileInterpolationFromSegments(segments)).toBe('\\`world\\`')
	})

	it('interpolation segment → ${expression}', () => {
		const segments: Segment[] = [
			{ kind: 'interpolation', start: 0, end: 6, expression: 'name' },
		]
		expect(compileInterpolationFromSegments(segments)).toBe('${name}')
	})

	it('mixed literal and interpolation', () => {
		const segments: Segment[] = [
			{ kind: 'literal', start: 0, end: 6, value: 'hello ' },
			{ kind: 'interpolation', start: 6, end: 12, expression: 'name' },
		]
		expect(compileInterpolationFromSegments(segments)).toBe('hello ${name}')
	})
})

describe('default options (attributeMode false)', () => {
	it('tokenizeCurlyInterpolation without options defaults to text mode', () => {
		const input = '{{'
		const segments = tokenizeCurlyInterpolation(input)
		expect(segments.length).toBeGreaterThanOrEqual(1)
	})
})
