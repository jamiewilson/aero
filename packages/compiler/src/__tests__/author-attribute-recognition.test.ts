import { describe, expect, it } from 'vitest'
import { parse } from '../parser'
import { compile } from '../codegen'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('prefixed author attributes recognition', () => {
	it.each([
		['is:build', 'is:state'],
		['aero-is:build', 'aero-is:state'],
		['data-aero-is-build', 'data-aero-is-state'],
	] as const)('parses script taxonomy %s / %s', (buildAttr, stateAttr) => {
		const html = `<script ${buildAttr}>const x = 1</script>
<script ${stateAttr}>let count = 0</script>
<div show="{ count }">{ count }</div>`
		const result = parse(html)
		expect(result.buildScript?.content).toContain('const x = 1')
		expect(result.stateScript?.content).toContain('let count = 0')
		expect(result.template).not.toContain(buildAttr)
		expect(result.template).not.toContain(stateAttr)
	})

	it('compiles show/on/class with aero and data-aero spellings', () => {
		const html = `<script data-aero-is-state>
			let count = 0
			let open = true
			let active = false
			function inc() { count++ }
		</script>
<button aero-on:click="{ inc() }" data-aero-class-is-active="{ active }" aero-show="{ open }">
	{ count }
</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-show')
		expect(code).toContain('data-aero-event')
		expect(code).toContain('data-aero-class-is-active')
	})

	it('compiles data-aero-bind-count on components', () => {
		const html = `<script is:state>
			let count = 0
		</script>
		<counter-component data-aero-bind-count="{ count }" />`

		const code = compile(parse(html), {
			...mockOptions,
			componentReactiveProps: {
				counter: [{ name: 'count', propName: 'count', required: false, bindable: true }],
			},
		})
		expect(code).toContain('count')
		expect(code).not.toContain('data-aero-bind-count')
	})
})
