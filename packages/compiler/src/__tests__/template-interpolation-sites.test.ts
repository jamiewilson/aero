import { describe, it, expect } from 'vitest'
import { collectTemplateInterpolationSites } from '../template-interpolation-sites'

describe('collectTemplateInterpolationSites', () => {
	it('marks props attribute interpolations for object-literal virtual wrap', () => {
		const html = `<x-component props="{ ...p }" /><p>{ other }</p>`
		const sites = collectTemplateInterpolationSites(html)
		expect(sites).toHaveLength(2)
		expect(sites[0]?.expression.trim()).toBe('...p')
		expect(sites[0]?.wrapPropsObjectLiteral).toBe(true)
		expect(sites[1]?.wrapPropsObjectLiteral).toBeFalsy()
	})

	it('treats data-props like props', () => {
		const html = `<x data-props="{ ...p }" />`
		const sites = collectTemplateInterpolationSites(html)
		expect(sites[0]?.wrapPropsObjectLiteral).toBe(true)
	})
})
