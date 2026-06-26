import { describe, expect, it } from 'vitest'
import { maskTemplateLiteralStatic } from '../analyzer/helpers'

describe('maskTemplateLiteralStatic', () => {
	it('masks static spans but keeps ${count}', () => {
		const input = '`<header-component bind:count="{ ${count} }" />`'
		const masked = maskTemplateLiteralStatic(input)
		expect(masked).toContain('${count}')
		expect(masked).not.toContain('header')
		expect([...masked.matchAll(/\bcount\b/g)].length).toBe(1)
	})
})
