import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

const hypermediaOptions = { ...mockOptions, reactivity: true, hypermedia: true }

/** Compiled mount helpers emitted before `export function mountStateBindings`. */
function mountPreamble(code: string): string {
	const end = code.indexOf('export function mountStateBindings')
	return end >= 0 ? code.slice(0, end) : code
}

function installScopeBlock(code: string): string {
	const match = code.match(/function __aeroInstallScopeFunctions\(scope\) \{[\s\S]*?\n\}/)
	expect(match, 'expected __aeroInstallScopeFunctions block').toBeTruthy()
	return match![0]
}

describe('state script lowering (characterization)', () => {
	describe('declaration forms', () => {
		it('installs function declarations on scope', () => {
			const html = `<script is:state>
let items = [{ id: 'a' }]
function remove() { items = items.slice(1) }
</script>
<button on:click="{ remove() }">Remove</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(install).toMatch(/scope\.remove = function\(\) \{ scope\.items = scope\.items\.slice\(1\) \}/)
			expect(code).not.toMatch(/function remove\(\) \{ items/)
		})

		it('installs block-body const arrows on scope', () => {
			const html = `<script is:state>
let items = [{ id: 'a' }]
const add = () => { items = [...items, { id: 'b' }] }
</script>
<button on:click="{ add() }">Add</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(code).not.toMatch(/const add = \(\) => \{ items/)
			expect(install).toMatch(
				/scope\.add = \(\) => \{ scope\.items = \[\.\.\.scope\.items, \{ id: 'b' \}\] \}/
			)
		})

		it('installs expression-body const arrows on scope', () => {
			const html = `<script is:state>
let items = [{ id: 'a' }]
const remove = () => (items.length === 0 ? null : items = items.slice(1))
</script>
<button on:click="{ remove() }">Remove</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(install).toMatch(
				/scope\.remove = \(\) => \(scope\.items\.length === 0 \? null : scope\.items = scope\.items\.slice\(1\)\)/
			)
		})
	})

	describe('nested arrows and param shadows', () => {
		it('does not qualify arrow params in nested expression bodies', () => {
			const html = `<script is:state>
import { withTransition } from 'x'
let items = [{ id: 'a' }]
const setItems = next => withTransition(() => (items = next))
const add = () => setItems([...items, { id: 'b' }])
</script>
<button on:click="{ add() }">Add</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(install).toContain(
				'scope.setItems = (next) => scope.withTransition(() => (scope.items = next))'
			)
			expect(code).not.toContain('scope.next')
		})

		it('rewrites nested handler bodies without shadowing callback params', () => {
			const html = `<script is:state>
let items = [{ id: 'a' }]
function setItems(next) { items = next }
const add = () => { setItems([...items, { id: 'b' }]) }
</script>
<button on:click="{ add() }">Add</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(install).toMatch(/scope\.setItems = function\(next\) \{ scope\.items = next \}/)
			expect(install).toMatch(
				/scope\.add = \(\) => \{ scope\.setItems\(\[\.\.\.scope\.items, \{ id: 'b' \}\]\) \}/
			)
			expect(code).not.toContain('scope.next')
		})
	})

	describe('TypeScript param annotations', () => {
		it('strips TS types from function params in scope install', () => {
			const html = `<script is:state>
import { withTransition } from 'x'
let items = [{ id: 'a' }]
function setItems(next: typeof items) {
	withTransition(() => { items = next })
}
</script>
<button on:click="{ setItems([]) }">Clear</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(install).toContain(
				'scope.setItems = function(next) { scope.withTransition(() => { scope.items = next }) }'
			)
			expect(install).not.toContain('next: typeof')
			expect(code).not.toContain('scope.next')
		})

		it('strips TS types from const arrow params in scope install', () => {
			const html = `<script is:state>
type Item = { id: string }
let items: Item[] = [{ id: 'a' }]
const setItems = (next: Item[]) => { items = next }
</script>
<button on:click="{ setItems([]) }">Clear</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(install).toMatch(/scope\.setItems = \(next\) => \{ scope\.items = next \}/)
			expect(install).not.toContain('Item[]')
		})

		it('strips typeof state bindings from const arrow params in scope install', () => {
			const html = `<script is:state>
let items = [{ id: 'a' }]
const setItems = (next: typeof items) =>
	document.startViewTransition({ update: () => (items = next), types: ['list-update'] })
</script>
<button on:click="{ setItems([]) }">Clear</button>`

			const code = compile(parse(html), mockOptions)
			const install = installScopeBlock(code)

			expect(install).toContain(
				"scope.setItems = (next) => document.startViewTransition({ update: () => (scope.items = next), types: ['list-update'] })"
			)
			expect(install).not.toContain('typeof items')
		})
	})

	describe('pure vs stateful module helpers', () => {
		it('keeps pure helpers at module scope and installs stateful ones on scope', () => {
			const html = `<script is:state>
const createID = () => crypto.randomUUID().split('-').pop()
let items = [{ id: createID() }]
function add() {
	const id = createID()
	items = [...items, { id }]
}
</script>
<button on:click="{ add() }">Add</button>`

			const preamble = mountPreamble(compile(parse(html), mockOptions))

			expect(preamble).toContain("const createID = () => crypto.randomUUID().split('-').pop()")
			expect(preamble).not.toContain('scope.createID =')
			expect(preamble).toMatch(/scope\.add = function\(\) \{[\s\S]*const id = createID\(\)/)
			expect(preamble).not.toContain('scope.crypto')
		})

		it('keeps unreferenced pure const arrows at module scope', () => {
			const html = `<script is:state>
const createID = () => crypto.randomUUID().split('-').pop()
let items = [{ id: createID() }]
const add = () => { items = [...items, { id: createID() }] }
</script>
<button on:click="{ add() }">Add</button>`

			const preamble = mountPreamble(compile(parse(html), mockOptions))

			expect(preamble).toContain("const createID = () => crypto.randomUUID().split('-').pop()")
			expect(preamble).not.toContain('scope.createID =')
		})
	})

	describe('hypermedia actions in handlers', () => {
		it('qualifies state refs in action handlers without rewriting object keys', () => {
			const html = `<script is:state>
let target = '#x'
function load() { GET('/api', { target, swap: 'innerHTML' }) }
</script>
<button on:click="{ load() }">Load</button>`

			const code = compile(parse(html), hypermediaOptions)
			const install = installScopeBlock(code)

			expect(install).toMatch(
				/scope\.load = function\(\) \{ scope\.GET\('\/api', \{ target: scope\.target, swap: 'innerHTML' \}\) \}/
			)
		})

		it('routes bare action calls through actions in event handlers', () => {
			const html = `<script is:state>
let label = 'Items'
</script>
<button on:click="{ GET('/api/items') }">{ label }</button>`

			const code = compile(parse(html), hypermediaOptions)
			expect(code).toMatch(/function __aeroEvent_0\(scope, actions[\s\S]*actions\.GET\('\/api\/items'\)/)
		})

		it('routes hypermedia state signal refs through actions in event handlers', () => {
			const html = `<script is:state>
let isSaving = false
</script>
<button on:click="{ GET('/api/demo', { target: '#x', state: isSaving }) }">go</button>`

			const code = compile(parse(html), hypermediaOptions)
			expect(code).toMatch(
				/function __aeroEvent_0\(scope, actions[\s\S]*actions\.__aeroSignal\("isSaving"\)/
			)
		})
	})

	describe('mixed declaration styles', () => {
		it('installs both function declarations and const arrows on scope', () => {
			const html = `<script is:state>
let items = [{ id: 'a' }]
function remove() { items = items.slice(1) }
const add = () => { items = [...items, { id: 'b' }] }
</script>
<button on:click="{ add() }">Add</button>
<button on:click="{ remove() }">Remove</button>`

			const install = installScopeBlock(compile(parse(html), mockOptions))

			expect(install).toMatch(/scope\.remove = function\(\) \{ scope\.items = scope\.items\.slice\(1\) \}/)
			expect(install).toMatch(
				/scope\.add = \(\) => \{ scope\.items = \[\.\.\.scope\.items, \{ id: 'b' \}\] \}/
			)
		})
	})

	describe('keyed-list patterns', () => {
		it('matches kitchen-sink keyed-list helper lowering', () => {
			const html = `<script is:state>
import { withTransition } from 'x'
const createID = () => crypto.randomUUID().split('-').pop()
const getRandomIndex = () => Math.floor(Math.random() * items.length)
const setItems = next => withTransition(() => (items = next))
let items = [{ id: createID() }]
const add = () => setItems([...items, { id: createID() }])
const remove = () => (items.length === 0 ? null : setItems(items.slice(1)))
</script>
<ul>
	<li for="{ const { id } of items }" key="{ id }">{ id }</li>
	<button on:click="{ add() }">Add</button>
	<button on:click="{ remove() }">Remove</button>
</ul>`

			const preamble = mountPreamble(compile(parse(html), mockOptions))

			expect(preamble).toContain("const createID = () => crypto.randomUUID().split('-').pop()")
			expect(preamble).toContain(
				'scope.setItems = (next) => scope.withTransition(() => (scope.items = next))'
			)
			expect(preamble).toMatch(/scope\.add = \(\) => scope\.setItems\(\[\.\.\.scope\.items/)
			expect(preamble).toMatch(/scope\.remove = \(\) => \(scope\.items\.length === 0/)
			expect(preamble).toContain('scope.getRandomIndex = () => Math.floor(Math.random() * scope.items.length)')
		})
	})
})
