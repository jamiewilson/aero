import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import {
	compileConditionalChain,
	getCondition,
	hasElseAttr,
	hasElseIfAttr,
	hasIfAttr,
} from '../conditionals'

describe('lowerer/conditionals', () => {
	function el(html: string) {
		const { document } = parseHTML(`<html><body>${html}</body></html>`)
		return document.body!.firstElementChild as any
	}

	it('hasIfAttr detects if and data-if', () => {
		expect(hasIfAttr(el('<span if="{true}">'))).toBe(true)
		expect(hasIfAttr(el('<span data-if="{true}">'))).toBe(true)
		expect(hasIfAttr(el('<span>'))).toBe(false)
	})

	it('hasElseIfAttr / hasElseAttr', () => {
		expect(hasElseIfAttr(el('<span else-if="{x}">'))).toBe(true)
		expect(hasElseAttr(el('<span else>'))).toBe(true)
	})

	it('getCondition reads braced expression', () => {
		const node = el('<span if="{foo}">')
		expect(getCondition(node, 'if', undefined)).toBe('foo')
	})

	it('compileConditionalChain produces one If IR node', () => {
		const { document } = parseHTML('<body></body>')
		const body = document.body!
		body.innerHTML = '<div if="{a}">x</div><div else-if="{b}">y</div><div else>z</div>'
		const nodes = body.childNodes
		const result = compileConditionalChain(
			{
				compileElement: () => [{ kind: 'Append', content: 'x', outVar: '__out' }],
			},
			undefined,
			nodes,
			0,
			false,
			'__out'
		)
		expect(result.consumed).toBe(3)
		expect(result.nodes).toHaveLength(1)
		expect(result.nodes[0]?.kind).toBe('If')
	})
})
