import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('reactive structural codegen', () => {
	it('emits reactive if anchor when condition references state', () => {
		const html = `<script is:state>
			let showPositive = true
			let showNegative = false
		</script>
		<div if="{ showPositive }">Positive</div>
		<div else-if="{ showNegative }">Negative</div>
		<div else>Zero</div>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-if="0"')
		expect(code).toContain('ifBinds:')
		expect(code).toContain('__aeroIfBranch_0_0')
	})

	it('emits reactive if branch renderers without slot accumulator vars', () => {
		const html = `<script is:state>
			let n = 0
		</script>
		<div class="card">
			<p if="{ n > 0 }">Positive</p>
			<p else-if="{ n < 0 }">Negative</p>
			<p else>Zero</p>
		</div>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('function __aeroIfBranch_0_2')
		expect(code).toMatch(/function __aeroIfBranch_0_2\([^)]*\)\s*\{[\s\S]*__out \+=/)
		expect(code).not.toMatch(/function __aeroIfBranch_0_2\([^)]*\)\s*\{[\s\S]*__slot_/)
	})

	it('keeps build-time if without state refs unchanged', () => {
		const html = `<script is:build>
			const ok = true
		</script>
		<div if="{ ok }">Yes</div>
		<div else>No</div>`

		const code = compile(parse(html), mockOptions)
		expect(code).not.toContain('data-aero-if=')
		expect(code).not.toContain('ifBinds:')
	})

	it('requires key on reactive for loops', () => {
		const html = `<script is:state>
			let items = [{ id: 1 }]
		</script>
		<ul>
			<li for="{ const item of items }">{ item.id }</li>
		</ul>`

		expect(() => compile(parse(html), mockOptions)).toThrow(/key/i)
	})

	it('emits keyed reactive for when key and state iterable are present', () => {
		const html = `<script is:state>
			let items = [{ id: 1, name: 'a' }]
		</script>
		<ul>
			<li for="{ const item of items }" key="{ item.id }" text="{ item.name }"></li>
		</ul>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-for="0"')
		expect(code).toContain('forBinds:')
		expect(code).toContain('__aeroForRow_0')
		expect(code).toContain('bindingNames:')
	})

	it('scopes keyed for text binds to rowMounts, not page-level textBinds', () => {
		const html = `<script is:state>
			let items = [{ id: 1, name: 'a' }]
		</script>
		<ul>
			<li for="{ const item of items }" key="{ item.id }" text="{ item.name }"></li>
		</ul>`

		const code = compile(parse(html), mockOptions)
		const mountBlock = code.slice(code.indexOf('mountStateBindings('))
		const topLevelTextBinds = mountBlock.match(/textBinds:\s*(\[[^\]]*\])/)?.[1]
		expect(topLevelTextBinds).toBe('[]')
		expect(code).toContain('rowMounts:')
		expect(code).toContain('scope.item.name')
		expect(code).toMatch(/function __aeroForRow_0[\s\S]*data-aero-text=\\"0\\"/)
	})

	it('destructures escapeHtml in keyed for row renderers', () => {
		const html = `<script is:state>
			let items = [{ id: 1 }]
		</script>
		<ul>
			<li for="{ const { id } of items }" key="{ id }">{ id }</li>
		</ul>`

		const code = compile(parse(html), mockOptions)
		expect(code).toMatch(
			/function __aeroForRow_0\(scope, Aero\) \{\nconst \{ styles, scripts, headScripts, nextPassDataId, escapeHtml/
		)
		expect(code).toContain('escapeHtml( scope.id )')
	})

	it('emits keyed for row html with a single root element', () => {
		const html = `<script is:state>
			let items = [{ id: 'a' }]
		</script>
		<ul class="card">
			<li class="list-item" for="{ const { id } of items }" key="{ id }">{ id }</li>
		</ul>`

		const code = compile(parse(html), mockOptions)
		const fnBody = code.match(/function __aeroForRow_0\(scope, Aero\) \{([\s\S]*?)\n\}/)?.[1]
		expect(fnBody).toBeTruthy()
		const renderRow = new Function(
			'scope',
			'Aero',
			`${fnBody}\nreturn __out;`
		) as (scope: { id: string }, Aero: { escapeHtml: (v: unknown) => string }) => string
		const htmlOut = renderRow({ id: 'a' }, { escapeHtml: v => String(v) }).trim()
		expect(htmlOut).toMatch(/^<li class="list-item">a<\/li>$/)
	})

	it('emits setItems helper with typed params in state scope functions', () => {
		const html = `<script is:state>
			import { withTransition } from '@scripts/utils/withTransition.ts'
			const createID = () => crypto.randomUUID().split('-').pop()
			let items = [{ id: createID() }]
			function setItems(next: typeof items) {
				withTransition(() => { items = next })
			}
			function add() {
				setItems([...items, { id: createID() }])
			}
		</script>
		<ul>
			<li for="{ const { id } of items }" key="{ id }">{ id }</li>
			<button on:click="{ add() }">Add</button>
		</ul>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain(
			'scope.setItems = function(next) { scope.withTransition(() => { scope.items = next }) }'
		)
		expect(code).not.toContain('next: typeof')
		expect(code).not.toContain('scope.next')
	})

	it('emits const arrow helpers and keeps crypto unqualified in state handlers', () => {
		const html = `<script is:state>
			const createID = () => crypto.randomUUID().split('-').pop()
			let items = [{ id: createID() }, { id: createID() }]
			function addRandom() {
				const id = createID()
				items = [...items, { id }]
			}
		</script>
		<ul>
			<li for="{ const { id } of items }" key="{ id }">{ id }</li>
			<button on:click="{ addRandom() }">Add random</button>
		</ul>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain("const createID = () => crypto.randomUUID().split('-').pop()")
		expect(code).toMatch(/function __aeroInit_items\(scope\) \{ return \(\[\{ id: createID\(\) \}/)
		expect(code).toMatch(/scope\.addRandom = function\(\) \{[\s\S]*const id = createID\(\)/)
		expect(code).not.toContain('scope.crypto')
		expect(code).not.toContain('scope.createID')
	})

	it('emits reactive switch anchor when discriminant references state', () => {
		const html = `<script is:state>
			let status = 'loading'
		</script>
		<div switch="{ status }">
			<p case="loading">Loading</p>
			<p case="error">Error</p>
			<p default>Ready</p>
		</div>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-switch="0"')
		expect(code).toContain('switchBinds:')
		expect(code).toContain('discriminant: __aeroSwitchExpr_0')
		expect(code).not.toMatch(/switchBinds:[\s\S]*expression: __aeroSwitchExpr_0/)
		expect(code).toContain('__aeroSwitchBranch_0_0')
		expect(code).toContain('__aeroSwitchDefault_0')
	})

	it('keeps build-time switch without state refs unchanged', () => {
		const html = `<script is:build>
			const status = 'ready'
		</script>
		<div switch="{ status }">
			<p case="loading">Loading</p>
			<p default>Ready</p>
		</div>`

		const code = compile(parse(html), mockOptions)
		expect(code).not.toContain('data-aero-switch=')
		expect(code).not.toContain('switchBinds:')
	})
})
