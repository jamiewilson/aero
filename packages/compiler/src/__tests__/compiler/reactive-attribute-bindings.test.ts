import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('reactive attribute bindings', () => {
	it('emits data-theme with data-aero-bind instead of property marker', () => {
		const html = `<script is:state>
			let theme = 'system'
		</script>
		<html data-theme="{ theme }"></html>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-theme="${ theme }"')
		expect(code).toContain('data-aero-bind="0"')
		expect(code).not.toContain('data-aero-property-data-theme')
		expect(code).toContain('attributeBinds:')
	})

	it('emits href with data-aero-bind', () => {
		const html = `<script is:state>
			let path = '/dashboard'
		</script>
		<a href="{ path }">Go</a>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('href="${ path }"')
		expect(code).toContain('data-aero-bind="0"')
		expect(code).not.toContain('data-aero-property-href')
	})

	it('emits aria-expanded with data-aero-bind', () => {
		const html = `<script is:state>
			let open = false
		</script>
		<button aria-expanded="{ open }">Menu</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('aria-expanded="${ open }"')
		expect(code).toContain('data-aero-bind="0"')
	})

	it('groups multiple attrs under one data-aero-bind marker', () => {
		const html = `<script is:state>
			let url = '/a.jpg'
			let caption = 'Photo'
			let width = 800
		</script>
		<img src="{ url }" alt="{ caption }" width="{ width }" />`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('src="${ url }"')
		expect(code).toContain('alt="${ caption }"')
		expect(code).toContain('width="${ width }"')
		expect(code.match(/data-aero-bind="/g)?.length).toBe(1)
	})

	it('keeps disabled on property bind path with SSR presence', () => {
		const html = `<script is:state>
			let saving = false
		</script>
		<button disabled="{ saving }">Save</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-property-disabled="0"')
		expect(code).not.toContain('data-aero-bind')
		expect(code).toContain('propertyBinds:')
	})

	it('keeps input value on model bind path', () => {
		const html = `<script is:state>
			let email = ''
		</script>
		<input value="{ email }" />`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-model-value="0"')
		expect(code).not.toContain('data-aero-bind')
	})

	it('does not emit bind markers without is:state', () => {
		const html = `<script is:build>
			let path = '/x'
		</script>
		<a href="{ path }">Go</a>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('href="${ path }"')
		expect(code).not.toContain('data-aero-bind')
	})
})
