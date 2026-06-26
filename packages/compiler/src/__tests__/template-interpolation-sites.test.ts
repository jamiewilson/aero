import { describe, it, expect } from 'vitest'
import {
	collectTemplateInterpolationSites,
	buildTemplateInterpolationVirtualText,
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

	it('includes braced expressions on Aero event directives', () => {
		const html = `<button on:click="{ inc() }">+</button><p>{ count }</p>`
		const sites = collectTemplateInterpolationSites(html)
		expect(sites.some(s => s.expression.trim() === 'inc()')).toBe(true)
		expect(sites.some(s => s.expression.trim() === 'count')).toBe(true)
		const eventSite = sites.find(s => s.expression.trim() === 'inc()')
		expect(eventSite?.isEventHandler).toBe(true)
	})

	it('does not treat component markup inside template literal snippets as attribute sites', () => {
		const html = `<code>{ \`<header-component bind:count="{ \${count} }" />\` }</code>`
		const sites = collectTemplateInterpolationSites(html)
		expect(sites).toHaveLength(1)
		expect(sites[0]?.expression.trim()).toBe(
			'`<header-component bind:count="{ ${count} }" />`'
		)
		const { virtualText } = buildTemplateInterpolationVirtualText(html, sites[0]!, '')
		expect(virtualText).toContain('${count}')
		expect(virtualText).not.toContain('[bind:count')
	})

	it('typechecks is:state assignments in event handlers with declare let and statement context', () => {
		const html = `<script is:state>let count = 0</script><button on:dblclick="{ count = 0 }">Reset</button>`
		const sites = collectTemplateInterpolationSites(html)
		const eventSite = sites.find(s => s.isEventHandler)
		expect(eventSite).toBeDefined()

		const { virtualText } = buildTemplateInterpolationVirtualText(html, eventSite!, '')
		expect(virtualText).toContain('declare let count')
		expect(virtualText).not.toContain('[ count = 0 ]')
		expect(virtualText).toContain('count = 0')
		expect(virtualText.endsWith(';')).toBe(true)
	})

	it('declares readonly live props as let in event handler virtual TS so Aero can own the diagnostic', () => {
		const html = `<script is:state>const { count } = Aero.props</script><button on:click="{ count++ }">+</button>`
		const sites = collectTemplateInterpolationSites(html)
		const eventSite = sites.find(s => s.isEventHandler)
		expect(eventSite).toBeDefined()

		const { virtualText } = buildTemplateInterpolationVirtualText(html, eventSite!, '')
		expect(virtualText).toContain('declare let count')
		expect(virtualText).toContain('count++')
	})

	it('keeps read-only interpolation bindings as declare const', () => {
		const html = `<script is:state>let count = 0</script><p>{ count }</p>`
		const prelude = formatInterpolationBinderPreludeFromTemplate(html, html.indexOf('count'))
		expect(prelude).toContain('declare const count')
		expect(prelude).not.toContain('declare let count')
	})

	it('declares event in on:* handler virtual TS', () => {
		const html = `<script is:state>
function syncAuthLink(event) { event.preventDefault() }
</script>
<a on:click="{ syncAuthLink(event) }">x</a>`
		const sites = collectTemplateInterpolationSites(html)
		const eventSite = sites.find(s => s.isEventHandler)
		expect(eventSite).toBeDefined()
		const { virtualText } = buildTemplateInterpolationVirtualText(html, eventSite!, '')
		expect(virtualText).toContain('declare const event: Event;')
		expect(virtualText).toMatch(/declare const event: Event;\s*syncAuthLink\(event\)/)
	})

	it('does not extract interpolations from Alpine directive attribute values', () => {
		const html = `<div x-bind:class="{ foo }">{ bar }</div>`
		const sites = collectTemplateInterpolationSites(html)
		expect(sites).toHaveLength(1)
		expect(sites[0]?.expression.trim()).toBe('bar')
	})
})
