import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { Lowerer } from '../lowerer'
import { Resolver } from '../../resolver'
import { compileSwitchContainer, parseCaseComparands, parentIsSwitchContainer } from '../switch'

describe('lowerer/switch', () => {
	const resolver = new Resolver({ root: '/', resolvePath: (s) => s, importer: '/' })

	it('parseCaseComparands handles literal and braced expression', () => {
		const { document } = parseHTML('<html><body><span case="a"></span></body></html>')
		const span = document.body!.firstElementChild!
		expect(parseCaseComparands(span, undefined)).toEqual([JSON.stringify('a')])
		const { document: d2 } = parseHTML('<html><body><span case="{ 404 }"></span></body></html>')
		const span2 = d2.body!.firstElementChild!
		expect(parseCaseComparands(span2, undefined)).toEqual(['404'])
	})

	it('parseCaseComparands handles grouped array', () => {
		const { document } = parseHTML(
			'<html><body><span case="{ [\'active\', \'pending\'] }"></span></body></html>'
		)
		const span = document.body!.firstElementChild!
		expect(parseCaseComparands(span, undefined)).toEqual(["'active'", "'pending'"])
	})

	it('parentIsSwitchContainer finds template.content children', () => {
		const { document } = parseHTML(
			'<html><body><template switch="{x}"><p case="a">h</p></template></body></html>'
		)
		const t = document.querySelector('template')!
		const p = t.content.querySelector('p')!
		expect(parentIsSwitchContainer(p)).toBe(true)
	})

	it('compileSwitchContainer produces Switch IR', () => {
		const { document } = parseHTML(
			'<html><body><div switch="{ status }"><span case="a">A</span><b default>B</b></div></body></html>'
		)
		const div = document.body!.firstElementChild!
		const lowerer = new Lowerer(resolver)
		const sw = compileSwitchContainer(
			{
				compileBranchBody: (n, s, o) => lowerer.compileWrapperAwareBranch(n, s, o),
			},
			undefined,
			div,
			'status',
			false,
			'__out'
		)
		expect(sw.kind).toBe('Switch')
		expect(sw.expression).toBe('status')
		expect(sw.cases).toHaveLength(1)
		expect(sw.cases[0]!.comparandExprs).toEqual([JSON.stringify('a')])
		expect(sw.defaultBody).toBeDefined()
	})
})
