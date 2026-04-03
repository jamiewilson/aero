import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { getEffectiveChildNodes, isTemplateElement } from '../template'

describe('lowerer/template', () => {
	function bodyFirstChild(html: string) {
		const { document } = parseHTML(`<html><body>${html}</body></html>`)
		return document.body!.firstElementChild as any
	}

	it('isTemplateElement is true for template', () => {
		expect(isTemplateElement(bodyFirstChild('<template></template>'))).toBe(true)
	})

	it('isTemplateElement is false for div', () => {
		expect(isTemplateElement(bodyFirstChild('<div></div>'))).toBe(false)
	})

	it('getEffectiveChildNodes reads template.content (canonical fragment)', () => {
		const el = bodyFirstChild('<template><span>a</span><p>b</p></template>')
		const effective = getEffectiveChildNodes(el)!
		expect(effective.length).toBe(2)
		expect((effective[0] as Element).tagName.toLowerCase()).toBe('span')
		expect((effective[1] as Element).tagName.toLowerCase()).toBe('p')
		// Same live list as `template.content.childNodes` (NodeList identity may differ per engine).
		const fromContent = (el as HTMLTemplateElement).content.childNodes
		expect(effective.length).toBe(fromContent.length)
		expect(effective[0]).toBe(fromContent[0])
	})

	it('getEffectiveChildNodes matches childNodes for non-template', () => {
		const el = bodyFirstChild('<div><i>x</i></div>')
		const eff = getEffectiveChildNodes(el)!
		expect(eff.length).toBe(el.childNodes.length)
		expect(eff[0]).toBe(el.childNodes[0])
	})
})
