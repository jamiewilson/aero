import { describe, expect, it } from 'vitest'
import { rewriteExprForScope, rewriteStmtForScope } from '../../scope-expr-codegen'

describe('rewriteExprForScope', () => {
	it('expands object shorthand properties into scope-qualified long form', () => {
		const scopeNames = new Set(['storageKey', 'defaultTheme', 'attribute'])
		const expr = `Aero.persist(storageKey, defaultTheme, {
			critical: true,
			attribute,
		})`
		expect(rewriteExprForScope(expr, scopeNames, { qualifyAllFreeIdentifiers: true })).toBe(
			`Aero.persist(scope.storageKey, scope.defaultTheme, {
			critical: true,
			attribute: scope.attribute,
		})`
		)
	})

	it('preserves block-scoped locals when qualifying free identifiers', () => {
		const scopeNames = new Set(['theme', 'themeOptions', 'withTransition'])
		const expr = `() => {
			const index = themeOptions.indexOf(theme)
			const next = themeOptions[(index + 1) % themeOptions.length]
			withTransition(() => {
				if (next) theme = next
			})
		}`
		expect(rewriteExprForScope(expr, scopeNames, { qualifyAllFreeIdentifiers: true })).toBe(
			`() => {
			const index = scope.themeOptions.indexOf(scope.theme)
			const next = scope.themeOptions[(index + 1) % scope.themeOptions.length]
			scope.withTransition(() => {
				if (next) scope.theme = next
			})
		}`
		)
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
})
