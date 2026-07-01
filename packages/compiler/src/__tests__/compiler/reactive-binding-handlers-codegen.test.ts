import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('reactive binding handlers codegen', () => {
	it('emits show and html bind records', () => {
		const html = `<script is:state>
			let open = true
			let body = '<b>x</b>'
		</script>
		<div show="{ open }"></div>
		<div html="{ body }"></div>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-show="0"')
		expect(code).toContain('data-aero-html="0"')
		expect(code).toContain('showBinds:')
		expect(code).toContain('htmlBinds:')
	})

	it('emits class and property bind records', () => {
		const html = `<script is:state>
			let isActive = true
			let loading = false
		</script>
		<div class:is-active="{ isActive }"></div>
		<button disabled="{ loading }">Save</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-class-is-active="0"')
		expect(code).toContain('classBinds:')
		expect(code).toContain('data-aero-property-disabled="0"')
		expect(code).toContain('propertyBinds:')
	})

	it('emits attribute bind records for data-theme', () => {
		const html = `<script is:state>
			let theme = 'dark'
		</script>
		<html data-theme="{ theme }"></html>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-bind="0"')
		expect(code).toContain('attributeBinds:')
		expect(code).not.toContain('data-aero-property-')
	})

	it('emits form model bind records for input value', () => {
		const html = `<script is:state>
			let email = ''
		</script>
		<input value="{ email }" />`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-model-value="0"')
		expect(code).toContain('modelBinds:')
	})
})
