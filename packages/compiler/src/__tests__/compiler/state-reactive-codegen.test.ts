import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('state reactive codegen (PR-2d)', () => {
	it('emits mountStateBindings for reactive text interpolations', () => {
		const html = `<script is:state>
			let count = 1
			let doubled = count * 2
		</script>
		<div>{ count }-{ doubled }</div>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain("import { mountStateBindings as __aeroMountStateBindings } from '@aero-js/reactivity'")
		expect(code).toContain('export function mountStateBindings(root, Aero)')
		expect(code).toContain('data-aero-text="0"')
		expect(code).toContain('readExpr":"escapeHtml( count ) + \\"-\\" + escapeHtml( doubled )')
		expect(code).toContain('actionFunctions: {}')
		expect(code).not.toContain('data-aero-on-click')
	})

	it('emits mountStateBindings for base on:* handlers in state scope', () => {
		const html = `<script is:state>
			let count = 1
			function inc() { count++ }
		</script>
		<button on:click="{ inc() }">{ count }</button>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('data-aero-event="0"')
		expect(code).toContain('"handlerExpr":"inc()"')
		expect(code).toContain('"event":"click"')
		expect(code).toContain('actionFunctions: {}')
		expect(code).not.toContain('data-aero-on-click')
	})

	it('does not emit mountStateBindings without is:state', () => {
		const html = `<button on:click="{ alert(1) }">{ 'x' }</button>`
		const code = compile(parse(html), mockOptions)

		expect(code).not.toContain('mountStateBindings')
		expect(code).not.toContain('data-aero-text=')
		expect(code).toContain('data-aero-on-click')
	})

	it('hydration payload includes owned bindings only', () => {
		const html = `<script is:state>
			let count = 1
			let doubled = count * 2
		</script>
		<div>{ count }</div>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('escapeScriptJson({ "count": count })')
		expect(code).not.toContain('"doubled": doubled')
		expect(code).not.toContain('"doubled":2')
	})
})
