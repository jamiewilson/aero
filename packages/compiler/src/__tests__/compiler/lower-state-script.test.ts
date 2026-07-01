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

	it('builds rewriteContext with module and scope names', () => {
		const script = `const createID = () => crypto.randomUUID()
let items = []
const add = () => { items = [...items, { id: createID() }] }`
		const { rewriteContext } = lower(script)

		expect(rewriteContext.moduleScopeNames.has('createID')).toBe(true)
		expect(rewriteContext.scopeNames.has('items')).toBe(true)
		expect(rewriteContext.scopeNames.has('add')).toBe(true)
	})
})
