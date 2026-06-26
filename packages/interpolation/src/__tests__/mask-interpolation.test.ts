import { describe, expect, it } from 'vitest'
import {
	collectInterpolationBodyRanges,
	isOffsetInRanges,
	maskInterpolationExpressionBodies,
} from '../index'

describe('maskInterpolationExpressionBodies', () => {
	it('masks markup inside Aero expression bodies', () => {
		const text = '<code>{ `<header-component bind:count="{ ${count} }" />` }</code>'
		const masked = maskInterpolationExpressionBodies(text)
		expect(masked).toContain('<code>{ ')
		expect(masked).toContain(' }</code>')
		expect(masked).not.toContain('header-component')
		expect(masked).not.toContain('${count}')
	})

	it('collectInterpolationBodyRanges aligns with isOffsetInRanges', () => {
		const text = '{ `x` }'
		const ranges = collectInterpolationBodyRanges(text)
		expect(ranges).toHaveLength(1)
		expect(isOffsetInRanges(2, ranges)).toBe(true)
		expect(isOffsetInRanges(0, ranges)).toBe(false)
	})
})
