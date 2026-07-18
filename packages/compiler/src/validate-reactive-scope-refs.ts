/**
 * Compile-time check: reactive template expressions may only reference mount-scope names,
 * for-loop bindings, hypermedia actions, handler shadows, and a small ambient global allowlist.
 */

import type { BuildScriptImport } from './build-script-analysis'
import {
	collectReactiveScopeIssues,
	type ReactiveScopeIssue,
} from './collect-reactive-binding-issues'
import type { IRNode } from './ir'
import type { StateScriptAnalysisResult } from './state-script-analysis'
import { CompileError } from './types'

export type { ReactiveScopeIssue }

/**
 * Fail compile when reactive template expressions reference names outside mount scope.
 */
export function validateReactiveScopeRefs(
	bodyIR: IRNode[],
	stateAnalysis: StateScriptAnalysisResult,
	stateScript: string,
	stateImports: readonly BuildScriptImport[],
	options: { file?: string; diagnosticSource?: string }
): void {
	const issues = collectReactiveScopeIssues(
		bodyIR,
		stateAnalysis,
		stateScript,
		stateImports,
		{ diagnosticSource: options.diagnosticSource }
	)
	const first = issues[0]
	if (!first) return
	throw new CompileError({
		message: first.message,
		file: options.file,
		line: first.line,
		column: first.column,
	})
}
