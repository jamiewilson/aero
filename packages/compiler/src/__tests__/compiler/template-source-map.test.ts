/**
 * Source map sites: bare props attribute → `{ ...props }` in generated JS.
 */

import { describe, expect, it } from 'vitest'
import { compileTemplateModule } from '../../codegen'
import {
	collectTemplateSourceMapSites,
	findBarePropsAttributeOffset,
	htmlOffsetToLineColumn,
	originalHtmlPositionForGeneratedOffset,
} from '../../template-source-map'

const opts = {
	root: '/project',
	resolvePath: (s: string) => s,
	importer: '/project/client/layouts/base.html',
}

describe('template source map', () => {
	it('finds bare props attribute, not const props in build script', () => {
		const html = `<script is:build>
	const props = Aero.props
</script>
<html><body><meta-component props /></body></html>`
		const offset = findBarePropsAttributeOffset(html)!
		expect(html.slice(offset, offset + 5)).toBe('props')
		expect(html.slice(0, offset)).toContain('meta-component')
		const loc = htmlOffsetToLineColumn(html, offset)
		expect(loc.line).toBe(4)
	})

	it('maps generated ...props to the bare attribute site', () => {
		const html = `<script is:build>
	import meta from './meta.html'
</script>
<html><body><meta-component props /></body></html>`
		const { code, map } = compileTemplateModule(html, opts)
		expect(map).not.toBeNull()
		expect(map!.mappings.length).toBeGreaterThan(0)
		expect(code).toContain('...props')

		const sites = collectTemplateSourceMapSites(code, html)
		const genAt = code.indexOf('...props') + 3
		const orig = originalHtmlPositionForGeneratedOffset(html, sites, genAt)
		expect(orig).toBeDefined()
		expect(html.split(/\r?\n/)[orig!.line - 1]).toContain('meta-component props')
	})

	it('maps braced interpolation identifiers', () => {
		const html = `<html><body>{ demoList }</body></html>`
		const { code } = compileTemplateModule(html, {
			...opts,
			importer: '/project/pages/home.html',
		})
		const sites = collectTemplateSourceMapSites(code, html)
		const genAt = code.search(/\bdemoList\b/)
		expect(genAt).toBeGreaterThanOrEqual(0)
		const orig = originalHtmlPositionForGeneratedOffset(html, sites, genAt)
		expect(orig?.line).toBe(1)
	})

	it('maps the first generated createID to the first live HTML call, not the last', () => {
		const html = `<script is:state>
	//import { createID } from './utils'
	let items = Array.from({ length: 1 }, () => ({ id: createID() }))
	const add = () => ({ id: createID() })
	const addRandom = () => ({ id: createID() })
</script>
<html><body></body></html>`
		const { code } = compileTemplateModule(html, {
			...opts,
			importer: '/project/pages/keyed-list.html',
			reactivity: true,
		})
		const sites = collectTemplateSourceMapSites(code, html)
		const firstGen = code.search(/\bcreateID\b/)
		expect(firstGen).toBeGreaterThanOrEqual(0)
		const orig = originalHtmlPositionForGeneratedOffset(html, sites, firstGen)
		expect(orig).toBeDefined()
		const lineText = html.split(/\r?\n/)[orig!.line - 1]!
		expect(lineText).toContain('Array.from')
		expect(lineText).not.toContain('addRandom')
	})
})
