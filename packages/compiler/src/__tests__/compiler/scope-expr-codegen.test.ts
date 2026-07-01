import { describe, expect, it } from 'vitest'
import {
	createScopeRewriteContext,
	rewriteFunctionSourceForScope,
	rewriteModuleHelperForScope,
	rewriteStmtForScope,
} from '../../scope-expr-codegen'
import { analyzeStateScript } from '../../state-script-analysis'
import { lowerStateScript } from '../../lower-state-script'

describe('createScopeRewriteContext', () => {
	it('separates pure module helpers from scope-installed helpers via lowering', () => {
		const script = `const createID = () => crypto.randomUUID()
let items = []
const add = () => { items = [...items, { id: createID() }] }`
		const analysis = analyzeStateScript(script)
		const ctx = lowerStateScript(script, analysis).rewriteContext

		expect(ctx.moduleScopeNames.has('createID')).toBe(true)
		expect(ctx.scopeNames.has('items')).toBe(true)
		expect(ctx.scopeNames.has('add')).toBe(true)
		expect(ctx.qualifyAllFreeIdentifiers).toBe(true)
	})

	it('builds binding-only context without lowered script', () => {
		const analysis = analyzeStateScript('let items = []')
		const ctx = createScopeRewriteContext(analysis)

		expect(ctx.scopeNames.has('items')).toBe(true)
		expect(ctx.moduleScopeNames.size).toBe(0)
	})
})

describe('rewriteStmtForScope', () => {
	const scopeNames = new Set(['count'])

	it('rewrites postfix increment and decrement', () => {
		expect(rewriteStmtForScope('count++', scopeNames, { qualifyAllFreeIdentifiers: true })).toBe(
			'scope.count++'
		)
		expect(rewriteStmtForScope('count--', scopeNames, { qualifyAllFreeIdentifiers: true })).toBe(
			'scope.count--'
		)
	})

	it('rewrites bare identifier statements', () => {
		expect(rewriteStmtForScope('count', scopeNames, { qualifyAllFreeIdentifiers: true })).toBe(
			'scope.count'
		)
	})

	it('does not rewrite object literal property keys', () => {
		const names = new Set(['target', 'swap'])
		expect(
			rewriteStmtForScope("GET('/api', { target: '#x', swap: 'innerHTML' })", names, {
				actionsNames: new Set(['GET']),
				qualifyAllFreeIdentifiers: true,
			})
		).toBe("actions.GET('/api', { target: '#x', swap: 'innerHTML' })")
	})

	it('rewrites object shorthand values without breaking the key', () => {
		const names = new Set(['items'])
		expect(
			rewriteStmtForScope('items = [...items, { id }]', names, {
				qualifyAllFreeIdentifiers: true,
			})
		).toBe('scope.items = [...scope.items, { id: scope.id }]')
	})

	it('does not rewrite locals shadowed by const declarations', () => {
		const names = new Set(['items', 'withTransition'])
		expect(
			rewriteStmtForScope(
				'const id = createID()\nwithTransition(() => (items = [...items, { id }]))',
				names,
				{
					qualifyAllFreeIdentifiers: true,
					moduleScopeNames: new Set(['createID']),
				}
			)
		).toBe(
			'const id = createID()\nscope.withTransition(() => (scope.items = [...scope.items, { id }]))'
		)
	})
})

describe('rewriteFunctionSourceForScope', () => {
	it('strips TS param types and preserves param identifiers in the body', () => {
		const scopeNames = new Set(['items', 'withTransition', 'setItems'])
		const source =
			'function setItems(next: typeof items) {\n\twithTransition(() => { items = next })\n}'
		expect(
			rewriteFunctionSourceForScope(source, scopeNames, {
				qualifyAllFreeIdentifiers: true,
			})
		).toBe(
			'scope.setItems = function(next) { scope.withTransition(() => { scope.items = next }) }'
		)
	})
})

describe('rewriteModuleHelperForScope', () => {
	it('preserves arrow param shadows in expression bodies', () => {
		const scopeNames = new Set(['items', 'withTransition', 'setItems'])
		const source = 'const setItems = next => withTransition(() => (items = next))'
		expect(
			rewriteModuleHelperForScope(
				{ name: 'setItems', source },
				scopeNames,
				{ qualifyAllFreeIdentifiers: true }
			)
		).toBe('scope.setItems = next => scope.withTransition(() => (scope.items = next))')
	})
})
