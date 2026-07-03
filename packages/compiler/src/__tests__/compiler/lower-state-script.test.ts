import { describe, expect, it } from 'vitest'
import { lowerStateScript } from '../../lower-state-script'
import { analyzeStateScript } from '../../state-script-analysis'

function lower(script: string) {
	const analysis = analyzeStateScript(script)
	return lowerStateScript(script, analysis)
}

describe('lowerStateScript', () => {
	it('lowers function declarations to scope install lines', () => {
		const script = `let items = []
function remove() { items = items.slice(1) }`
		const { scopeFunctions, moduleConstants } = lower(script)

		expect(moduleConstants).toEqual([])
		expect(scopeFunctions).toHaveLength(1)
		expect(scopeFunctions[0]!.name).toBe('remove')
		expect(scopeFunctions[0]!.installSource).toBe(
			'scope.remove = function() { scope.items = scope.items.slice(1) }'
		)
	})

	it('lowers stateful const arrows and keeps pure helpers as module constants', () => {
		const script = `const createID = () => crypto.randomUUID()
let items = []
const add = () => { items = [...items, { id: createID() }] }`
		const { scopeFunctions, moduleConstants } = lower(script)

		expect(moduleConstants).toEqual(['const createID = () => crypto.randomUUID()'])
		expect(scopeFunctions.map(fn => fn.name)).toEqual(['add'])
		expect(scopeFunctions[0]!.installSource).toMatch(
			/^scope\.add = \(\) => \{scope\.items = \[\.\.\.scope\.items/
		)
	})

	it('lowers expression-body arrows without qualifying params', () => {
		const script = `import { withTransition } from 'x'
let items = [{ id: 'a' }]
const setItems = next => withTransition(() => (items = next))`
		const analysis = analyzeStateScript(script)
		const { scopeFunctions } = lowerStateScript(script, analysis, [
			{
				specifier: 'x',
				defaultBinding: null,
				namespaceBinding: null,
				namedBindings: [{ imported: 'withTransition', local: 'withTransition' }],
			},
		])

		expect(scopeFunctions).toHaveLength(1)
		expect(scopeFunctions[0]!.installSource).toBe(
			'scope.setItems = next => scope.withTransition(() => (scope.items = next))'
		)
	})

	it('strips TS types from function declaration params', () => {
		const script = `let items = [{ id: 'a' }]
function setItems(next: typeof items) {
	items = next
}`
		const { scopeFunctions } = lower(script)

		expect(scopeFunctions[0]!.installSource).toBe(
			'scope.setItems = function(next) { scope.items = next }'
		)
	})

	it('preserves async on function declarations with await bodies', () => {
		const script = `import { GET } from 'x'
let itemCount = 0
async function appendItemFn() {
	itemCount++
	await GET(\`/api/x?n=\${itemCount}\`, { target: '#list' })
}`
		const analysis = analyzeStateScript(script)
		const { scopeFunctions } = lowerStateScript(script, analysis, [
			{
				specifier: 'x',
				defaultBinding: null,
				namespaceBinding: null,
				namedBindings: [{ imported: 'GET', local: 'GET' }],
			},
		])
		expect(scopeFunctions[0]!.installSource).toMatch(
			/^scope\.appendItemFn = async function\(\) \{[\s\S]*scope\.itemCount\+\+/
		)
	})

	it('does not qualify document in stateful handlers', () => {
		const script = `let items = []
const setItems = next => document.startViewTransition({ update: () => (items = next), types: ['list-update'] })`
		const { scopeFunctions } = lower(script)

		expect(scopeFunctions[0]!.installSource).toBe(
			"scope.setItems = next => document.startViewTransition({ update: () => (scope.items = next), types: ['list-update'] })"
		)
	})

	it('rewrites state refs in async arrow block bodies for hypermedia handlers', () => {
		const script = `import { GET } from '@aero-js/hypermedia'
let isSaving = false
let itemCount = 0
const appendItem = async () => {
	itemCount++
	await GET(\`/api/hypermedia/item?n=\${itemCount}\`, {
		target: '#item-list',
		swap: 'beforeend',
	})
}`
		const analysis = analyzeStateScript(script)
		const { scopeFunctions } = lowerStateScript(script, analysis, [
			{
				specifier: '@aero-js/hypermedia',
				defaultBinding: null,
				namespaceBinding: null,
				namedBindings: [{ imported: 'GET', local: 'GET' }],
			},
		])
		expect(scopeFunctions[0]!.installSource).toContain('scope.itemCount++')
		expect(scopeFunctions[0]!.installSource).toMatch(/\$\{scope\.itemCount\}/)
	})
})
