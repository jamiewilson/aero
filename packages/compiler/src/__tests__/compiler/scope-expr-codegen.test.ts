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
})
