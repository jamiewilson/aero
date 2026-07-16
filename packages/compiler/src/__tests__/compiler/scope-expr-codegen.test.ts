import { describe, expect, it } from 'vitest'
import { parseSync } from 'oxc-parser'
import {
	createScopeRewriteContext,
	EVENT_HANDLER_SHADOWS,
	HYPERMEDIA_ACTION_NAMES,
	collectScopeReferences,
	findUndeclaredReactiveIdentifiers,
	REACTIVE_EXPR_AMBIENT_GLOBALS,
	rewriteStmtForScope,
	scopeRewriteContext,
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
		for (const name of HYPERMEDIA_ACTION_NAMES) {
			expect(ctx.scopeNames.has(name)).toBe(true)
		}
	})

	it('builds binding-only context without lowered script', () => {
		const analysis = analyzeStateScript('let items = []')
		const ctx = createScopeRewriteContext(analysis)

		expect(ctx.scopeNames.has('items')).toBe(true)
		expect(ctx.moduleScopeNames.size).toBe(0)
	})
})

describe('rewriteStmtForScope', () => {
	const ctx = scopeRewriteContext(new Set(['count']))

	it('rewrites postfix increment and decrement', () => {
		expect(rewriteStmtForScope('count++', ctx)).toBe('scope.count++')
		expect(rewriteStmtForScope('count--', ctx)).toBe('scope.count--')
	})

	it('does not rewrite bare identifier statements', () => {
		expect(rewriteStmtForScope('count', ctx)).toBe('scope.count')
	})

	it('rewrites mount builtins to scope', () => {
		const rootCtx = createScopeRewriteContext(analyzeStateScript('let count = 0'))
		expect(rewriteStmtForScope('$root.querySelector("x")', rootCtx)).toBe(
			'scope.$root.querySelector("x")'
		)
	})

	it('does not rewrite object literal property keys', () => {
		expect(
			rewriteStmtForScope(
				"GET('/api', { target: '#x', swap: 'innerHTML' })",
				scopeRewriteContext(new Set(['target', 'swap'])),
				{ actionsNames: new Set(['GET']) }
			)
		).toBe("actions.GET('/api', { target: '#x', swap: 'innerHTML' })")
	})

	it('rewrites object shorthand only for known scope names', () => {
		expect(
			rewriteStmtForScope('items = [...items, { id }]', scopeRewriteContext(new Set(['items', 'id'])))
		).toBe('scope.items = [...scope.items, { id: scope.id }]')
	})

	it('does not rewrite unknown free identifiers or globals', () => {
		expect(
			rewriteStmtForScope(
				"document.startViewTransition({ update: () => (items = next), types: ['list-update'] })",
				scopeRewriteContext(new Set(['items']))
			)
		).toBe(
			"document.startViewTransition({ update: () => (scope.items = next), types: ['list-update'] })"
		)
	})

	it('rewrites await bodies in async arrow helpers', () => {
		const stmt = `itemCount++
await GET(\`/api/x?n=\${itemCount}\`, { target: '#list' })`
		expect(
			rewriteStmtForScope(
				stmt,
				scopeRewriteContext(new Set(['itemCount', 'GET']), {
					moduleScopeNames: new Set(['GET']),
				})
			)
		).toContain('scope.itemCount++')
	})

	it('does not rewrite locals shadowed by const declarations', () => {
		expect(
			rewriteStmtForScope(
				'const id = createID()\nwithTransition(() => (items = [...items, { id }]))',
				scopeRewriteContext(new Set(['items', 'withTransition']), {
					moduleScopeNames: new Set(['createID']),
				})
			)
		).toBe(
			'const id = createID()\nscope.withTransition(() => (scope.items = [...scope.items, { id }]))'
		)
	})

	it('does not rewrite injected event handler params', () => {
		expect(
			rewriteStmtForScope(
				'event.preventDefault(); count++',
				scopeRewriteContext(new Set(['count', 'event'])),
				{ initialShadows: EVENT_HANDLER_SHADOWS }
			)
		).toBe('event.preventDefault(); scope.count++')
	})

	it('collectScopeReferences ignores globals not on the allowlist', () => {
		const parsed = parseSync('scope-fn.ts', '() => crypto.randomUUID()', {
			sourceType: 'module',
			range: true,
			lang: 'ts',
		})
		expect(collectScopeReferences(parsed.program, 0, new Set(['items'])).size).toBe(0)
	})

	it('findUndeclaredReactiveIdentifiers reports missing names and ignores ambient globals', () => {
		const allowed = new Set(['items', ...REACTIVE_EXPR_AMBIENT_GLOBALS])
		expect(findUndeclaredReactiveIdentifiers('add()', allowed)).toEqual(['add'])
		expect(findUndeclaredReactiveIdentifiers('Math.random()', allowed)).toEqual([])
		expect(findUndeclaredReactiveIdentifiers('items.length', allowed)).toEqual([])
	})
})
