import { describe, expect, it } from 'vitest'
import { parsePropsAttributeBindings } from '../parse-props-attribute-bindings'

const buildProps = new Map<string, ReadonlySet<string>>([
	['theme', new Set(['fg', 'bg', 'accent'])],
	['props', new Set(['token', 'label'])],
])

describe('parsePropsAttributeBindings', () => {
	it('parses shorthand object keys', () => {
		const result = parsePropsAttributeBindings('props="{ storageKey, attribute }"')
		expect(result.injectedNames).toEqual(['storageKey', 'attribute'])
		expect(result.expressionRefs).toEqual(['storageKey', 'attribute'])
	})

	it('parses spread and resolves keys from build binding properties', () => {
		const result = parsePropsAttributeBindings('props="{ ...theme }"', buildProps)
		expect(result.injectedNames).toEqual(['fg', 'bg', 'accent'])
		expect(result.expressionRefs).toEqual(['theme'])
	})

	it('parses bare props using build-scope props object keys', () => {
		const result = parsePropsAttributeBindings('props', buildProps)
		expect(result.injectedNames).toEqual(['token', 'label'])
		expect(result.expressionRefs).toEqual([])
	})

	it('parses data-props bare form', () => {
		const result = parsePropsAttributeBindings('data-props', buildProps)
		expect(result.injectedNames).toEqual(['token', 'label'])
	})

	it('returns empty when props attribute is missing', () => {
		const result = parsePropsAttributeBindings('class="x"')
		expect(result.injectedNames).toEqual([])
		expect(result.expressionRefs).toEqual([])
	})

	it('parses keyed object injecting property names and expression refs', () => {
		const result = parsePropsAttributeBindings('props="{ title: site.home.title }"')
		expect(result.injectedNames).toEqual(['title'])
		expect(result.expressionRefs).toEqual(['title', 'site'])
	})

	it('returns empty injected names for spread when build binding is unknown', () => {
		const result = parsePropsAttributeBindings('props="{ ...unknown }"')
		expect(result.injectedNames).toEqual([])
		expect(result.expressionRefs).toEqual(['unknown'])
	})
})
