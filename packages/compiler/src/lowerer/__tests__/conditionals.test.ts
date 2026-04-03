import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { Lowerer } from '../lowerer'
import { Resolver } from '../../resolver'
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
				compileBranchBody: () => [{ kind: 'Append', content: 'x', outVar: '__out' }],
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

	it('compileConditionalChain compiles template branches wrapperless (no template tags in IR)', () => {
		const { document } = parseHTML('<body></body>')
		const body = document.body!
		body.innerHTML =
			'<template if="{a}"><span>a</span></template><template else-if="{b}"><b>b</b></template><template else><i>c</i></template>'
		const resolver = new Resolver({ root: '/', resolvePath: (s) => s, importer: '/' })
		const lowerer = new Lowerer(resolver)
		const result = compileConditionalChain(
			{
				compileBranchBody: (n, skip, o) => lowerer.compileWrapperAwareBranch(n, skip, o),
			},
			undefined,
			body.childNodes,
			0,
			false,
			'__out'
		)
		expect(result.consumed).toBe(3)
		const serialized = JSON.stringify(result.nodes)
		expect(serialized).not.toMatch(/<template/i)
		expect(serialized).toContain('<span')
		expect(serialized).toContain('<b>')
		expect(serialized).toContain('<i>')
	})

	it('compileConditionalChain skips comment nodes between branches', () => {
		const { document } = parseHTML('<body></body>')
		const body = document.body!
		body.innerHTML =
			'<template if="{x}"><p>a</p></template><!-- sep --><template else><p>b</p></template>'
		const resolver = new Resolver({ root: '/', resolvePath: (s) => s, importer: '/' })
		const lowerer = new Lowerer(resolver)
		const result = compileConditionalChain(
			{
				compileBranchBody: (n, skip, o) => lowerer.compileWrapperAwareBranch(n, skip, o),
			},
			undefined,
			body.childNodes,
			0,
			false,
			'__out'
		)
		expect(result.consumed).toBe(3)
		expect(result.nodes).toHaveLength(1)
		expect(result.nodes[0]?.kind).toBe('If')
	})
})
