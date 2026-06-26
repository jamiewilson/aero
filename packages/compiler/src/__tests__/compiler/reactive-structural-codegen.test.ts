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
		expect(code).toMatch(/rowMounts:[\s\S]*item\.name/)
		expect(code).toMatch(/function __aeroForRow_0[\s\S]*data-aero-text=\\"0\\"/)
	})
})
