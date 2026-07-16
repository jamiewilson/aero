/**
 * Compile-time check: reactive template expressions may only reference mount-scope names,
 * for-loop bindings, hypermedia actions, handler shadows, and a small ambient global allowlist.
 */

import type { BuildScriptImport } from './build-script-analysis'
import { FOR_LOOP_IMPLICIT_NAMES } from './for-directive'
import { lineColumnAtOffset } from './helpers'
import type { IRNode } from './ir'
import { lowerStateScript } from './lower-state-script'
import {
	EVENT_HANDLER_SHADOWS,
	findUndeclaredReactiveIdentifiers,
	MODEL_WRITE_SHADOWS,
	REACTIVE_EXPR_AMBIENT_GLOBALS,
	type ScopeRewriteContext,
} from './scope-expr-codegen'
import { collectReactiveBinds, type CollectedReactiveBinds } from './state-mount-codegen'
import type { StateScriptAnalysisResult } from './state-script-analysis'
import { CompileError } from './types'

function withStructuralScopeNames(
	ctx: ScopeRewriteContext,
	binds: CollectedReactiveBinds
): ScopeRewriteContext {
	const scopeNames = new Set(ctx.scopeNames)
	for (const forBind of binds.forBinds) {
		for (const name of forBind.bindingNames) scopeNames.add(name)
		for (const name of FOR_LOOP_IMPLICIT_NAMES) scopeNames.add(name)
	}
	return { ...ctx, scopeNames }
}

function buildAllowedNames(ctx: ScopeRewriteContext): Set<string> {
	const allowed = new Set<string>(REACTIVE_EXPR_AMBIENT_GLOBALS)
	for (const name of ctx.scopeNames) allowed.add(name)
	for (const name of ctx.moduleScopeNames) allowed.add(name)
	return allowed
}

function locateNameInSource(
	source: string | undefined,
	expr: string,
	name: string
): { line?: number; column?: number } {
	if (!source) return {}
	const exprIdx = source.indexOf(expr)
	if (exprIdx >= 0) {
		const local = expr.indexOf(name)
		const offset = local >= 0 ? exprIdx + local : exprIdx
		return lineColumnAtOffset(source, offset)
	}
	const nameIdx = source.indexOf(name)
	if (nameIdx >= 0) return lineColumnAtOffset(source, nameIdx)
	return {}
}

function throwUndeclared(
	name: string,
	expr: string,
	file: string | undefined,
	source: string | undefined
): never {
	const loc = locateNameInSource(source, expr, name)
	throw new CompileError({
		message: `Unknown name \`${name}\` in reactive expression. Declare it in \`<script is:state>\` or import it.`,
		file,
		...loc,
	})
}

function checkExpr(
	expr: string,
	allowed: ReadonlySet<string>,
	file: string | undefined,
	source: string | undefined,
	options?: { initialShadows?: ReadonlySet<string> }
): void {
	const undeclared = findUndeclaredReactiveIdentifiers(expr, allowed, options)
	if (undeclared.length > 0) throwUndeclared(undeclared[0]!, expr, file, source)
}

function checkBinds(
	binds: CollectedReactiveBinds,
	allowed: ReadonlySet<string>,
	file: string | undefined,
	source: string | undefined
): void {
	for (const bind of binds.textBinds) {
		// `__aeroTextRead_*` injects `escapeHtml` as a parameter.
		const textAllowed = new Set(allowed)
		textAllowed.add('escapeHtml')
		checkExpr(bind.readExpr, textAllowed, file, source)
	}
	for (const bind of binds.showBinds) checkExpr(bind.readExpr, allowed, file, source)
	for (const bind of binds.htmlBinds) checkExpr(bind.readExpr, allowed, file, source)
	for (const bind of binds.busyBinds) checkExpr(bind.readExpr, allowed, file, source)
	for (const bind of binds.classBinds) checkExpr(bind.readExpr, allowed, file, source)
	for (const bind of binds.propertyBinds) checkExpr(bind.readExpr, allowed, file, source)
	for (const bind of binds.attributeBinds) {
		for (const attr of bind.attributes) checkExpr(attr.readExpr, allowed, file, source)
	}
	for (const bind of binds.modelBinds) {
		checkExpr(bind.readExpr, allowed, file, source)
		checkExpr(bind.writeExpr, allowed, file, source, { initialShadows: MODEL_WRITE_SHADOWS })
	}
	for (const bind of binds.eventBinds) {
		checkExpr(bind.handlerExpr, allowed, file, source, {
			initialShadows: EVENT_HANDLER_SHADOWS,
		})
	}
	for (const bind of binds.ifBinds) {
		for (const branch of bind.branches) {
			if (branch.conditionExpr != null) checkExpr(branch.conditionExpr, allowed, file, source)
		}
	}
	for (const bind of binds.forBinds) {
		checkExpr(bind.itemsExpr, allowed, file, source)
		checkExpr(bind.keyExpr, allowed, file, source)
	}
	for (const bind of binds.switchBinds) {
		checkExpr(bind.expression, allowed, file, source)
		for (const branch of bind.cases) {
			for (const comparand of branch.comparandExprs) checkExpr(comparand, allowed, file, source)
		}
	}
}

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
	const binds = collectReactiveBinds(bodyIR)
	const lowered = lowerStateScript(stateScript, stateAnalysis, stateImports)
	const ctx = withStructuralScopeNames(lowered.rewriteContext, binds)
	const allowed = buildAllowedNames(ctx)
	checkBinds(binds, allowed, options.file, options.diagnosticSource)
}
