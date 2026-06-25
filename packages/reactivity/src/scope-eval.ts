import type { StateScope } from './state-scope'

/** Compile a state-scope expression into a zero-arg reader. */
export function compileScopeRead(readExpr: string, scope: StateScope): () => unknown {
	// eslint-disable-next-line @typescript-eslint/no-implied-eval
	return new Function('scope', `return function() { with (scope) { return (${readExpr}); } }`)(
		scope
	) as () => unknown
}

/** Evaluate a boolean condition expression against a state scope. */
export function evalScopeCondition(conditionExpr: string, scope: StateScope): boolean {
	return Boolean(compileScopeRead(conditionExpr, scope)())
}
