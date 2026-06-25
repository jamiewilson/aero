import { describe, expect, it } from 'vitest'
import {
	attributeSectionBase,
	findAttributeRange,
	findTagNameRange,
	sliceRawAttrs,
} from '../diagnostics/helpers'

describe('attribute range helpers', () => {
	it('finds a double-quoted attribute with leading whitespace', () => {
		const fullTag = '<header-component title="Counter Demo" count="{ count }" />'
		const tagStart = 10
		const tagName = 'header-component'
		const attrs = sliceRawAttrs(tagName, fullTag)
		const attrBase = attributeSectionBase(tagStart, tagName)
		const range = findAttributeRange(attrs, attrBase, 'count')
		expect(range).toEqual({
			start: tagStart + fullTag.indexOf('count="{ count }"'),
			end: tagStart + fullTag.indexOf('count="{ count }"') + 'count="{ count }"'.length,
		})
	})

	it('finds a single-quoted bind attribute', () => {
		const fullTag = "<counter-component bind:count='{ count }' />"
		const tagStart = 0
		const tagName = 'counter-component'
		const attrs = sliceRawAttrs(tagName, fullTag)
		const attrBase = attributeSectionBase(tagStart, tagName)
		const range = findAttributeRange(attrs, attrBase, 'bind:count')
		expect(range).toEqual({
			start: fullTag.indexOf('bind:count'),
			end: fullTag.indexOf('bind:count') + "bind:count='{ count }'".length,
		})
	})

	it('finds obsolete readonly attribute names', () => {
		const fullTag = '<counter-component count:readonly="{ count }" />'
		const tagStart = 5
		const tagName = 'counter-component'
		const attrs = sliceRawAttrs(tagName, fullTag)
		const attrBase = attributeSectionBase(tagStart, tagName)
		const range = findAttributeRange(attrs, attrBase, 'count:readonly')
		expect(range).toEqual({
			start: tagStart + fullTag.indexOf('count:readonly'),
			end:
				tagStart +
				fullTag.indexOf('count:readonly') +
				'count:readonly="{ count }"'.length,
		})
	})

	it('returns null when attribute is missing', () => {
		const fullTag = '<counter-component title="Demo" />'
		const tagName = 'counter-component'
		const attrs = sliceRawAttrs(tagName, fullTag)
		const attrBase = attributeSectionBase(0, tagName)
		expect(findAttributeRange(attrs, attrBase, 'count')).toBeNull()
	})

	it('covers only the tag name for import diagnostics', () => {
		const tagStart = 12
		const tagName = 'header-component'
		expect(findTagNameRange(tagStart, tagName)).toEqual({
			start: tagStart,
			end: tagStart + 1 + tagName.length,
		})
	})
})
