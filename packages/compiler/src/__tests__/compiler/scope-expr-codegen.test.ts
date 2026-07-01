import { describe, expect, it } from 'vitest'
import { rewriteStmtForScope } from '../../scope-expr-codegen'

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
