import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('const arrow event handlers', () => {
	it('installs stateful const arrow helpers on scope with rewritten bodies', () => {
		const html = `<script is:state>
let items = [{ id: 'a' }]
function setItems(next) { items = next }
const add = () => { setItems([...items, { id: 'b' }]) }
</script>
<button on:click="{ add() }">Add</button>`

		const code = compile(parse(html), mockOptions)

		expect(code).not.toMatch(/const add = \(\) => \{ setItems/)
		expect(code).toMatch(
			/scope\.add = \(\) => \{[\s\S]*scope\.setItems\(\[\.\.\.scope\.items, \{ id: 'b' \}\]\)/
		)
		expect(code).toMatch(/function __aeroEvent_0\(scope[\s\S]*\{\s*scope\.add\(\)/)
	})

	it('keeps pure const arrow helpers at module scope', () => {
		const html = `<script is:state>
const createID = () => crypto.randomUUID().split('-').pop()
let items = [{ id: createID() }]
function addRandom() {
	const id = createID()
	items = [...items, { id }]
}
</script>
<button on:click="{ addRandom() }">Add</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain("const createID = () => crypto.randomUUID().split('-').pop()")
		expect(code).not.toContain('scope.createID =')
	})

	it('rewrites expression-body const arrows like block-body arrows', () => {
		const html = `<script is:state>
import { withTransition } from 'x'
let items = [{ id: 'a' }]
const setItems = next => withTransition(() => (items = next))
const add = () => setItems([...items, { id: 'b' }])
</script>
<button on:click="{ add() }">Add</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain(
			'scope.setItems = next => scope.withTransition(() => (scope.items = next))'
		)
		expect(code).not.toContain('scope.next')
	})
})
