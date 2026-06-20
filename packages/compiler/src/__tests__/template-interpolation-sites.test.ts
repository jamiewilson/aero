import { describe, it, expect } from 'vitest'
import {
	collectTemplateInterpolationSites,
	formatInterpolationBinderPreludeFromTemplate,
} from '../template-interpolation-sites'

describe('collectTemplateInterpolationSites', () => {
	it('marks props attribute interpolations for object-literal virtual wrap', () => {
		const html = `<x-component props="{ ...p }" /><p>{ other }</p>`
		const sites = collectTemplateInterpolationSites(html)
		expect(sites).toHaveLength(2)
		expect(sites[0]?.expression.trim()).toBe('...p')
		expect(sites[0]?.wrapPropsObjectLiteral).toBe(true)
		expect(sites[1]?.wrapPropsObjectLiteral).toBeFalsy()
	})

	it('treats aero-props like props', () => {
		const html = `<x aero-props="{ ...p }" />`
		const sites = collectTemplateInterpolationSites(html)
		expect(sites[0]?.wrapPropsObjectLiteral).toBe(true)
	})

	it('includes for-loop bindings in same-tag attribute interpolation prelude', () => {
		const html = `<a for="{ const { path, label } of links }" href="{ path }"> { label } </a>`
		const sites = collectTemplateInterpolationSites(html)
		const hrefSite = sites.find(s => s.expression.trim() === 'path')
		expect(hrefSite).toBeDefined()
		const prelude = formatInterpolationBinderPreludeFromTemplate(html, hrefSite!.braceOffset)
		expect(prelude).toContain('declare const path: any;')
	})
})
