/**
 * Collect reactive-binding scope issues without throwing (IDE + compile share this).
 */

import { analyzeBuildScript, type BuildScriptImport } from './build-script-analysis'
import { FOR_LOOP_IMPLICIT_NAMES } from './for-directive'
import { locateInTemplateSource } from './helpers'
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
import { CompileError, type CompileOptions } from './types'
import { buildTemplateAnalysis } from './template-analysis'
import { parse } from './parser'
import { Resolver } from './resolver'

export interface ReactiveScopeIssue {
	readonly message: string
	readonly name: string
	readonly expr: string
	readonly line?: number
	readonly column?: number
}

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

function maskScriptAndStyleForLocation(source: string): string {
	return source.replace(
		/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
		match => ' '.repeat(match.length)
	)
}

function locateNameInSource(
	source: string | undefined,
	expr: string,
	name: string
): { line?: number; column?: number } {
	if (!source) return {}
	const templateHaystack = maskScriptAndStyleForLocation(source)
	for (const haystack of [templateHaystack, source]) {
		const exprIdx = haystack.indexOf(expr)
		if (exprIdx >= 0) {
			const local = expr.indexOf(name)
			const offset = local >= 0 ? exprIdx + local : exprIdx
			return locateInTemplateSource(source, { offset }) ?? {}
		}
		const nameIdx = haystack.indexOf(name)
		if (nameIdx >= 0) return locateInTemplateSource(source, { offset: nameIdx }) ?? {}
	}
	return {}
}

function undeclaredMessage(name: string): string {
	return `Unknown name \`${name}\` in reactive expression. Declare it in \`<script is:state>\` or import it.`
}

function collectFromExpr(
	out: ReactiveScopeIssue[],
	expr: string,
	allowed: ReadonlySet<string>,
	source: string | undefined,
	options?: { initialShadows?: ReadonlySet<string> }
): void {
	const undeclared = findUndeclaredReactiveIdentifiers(expr, allowed, options)
	for (const name of undeclared) {
		const loc = locateNameInSource(source, expr, name)
		out.push({ message: undeclaredMessage(name), name, expr, ...loc })
	}
}

function collectFromBinds(
	binds: CollectedReactiveBinds,
	allowed: ReadonlySet<string>,
	source: string | undefined
): ReactiveScopeIssue[] {
	const out: ReactiveScopeIssue[] = []
	for (const bind of binds.textBinds) {
		const textAllowed = new Set(allowed)
		textAllowed.add('escapeHtml')
		collectFromExpr(out, bind.readExpr, textAllowed, source)
	}
	for (const bind of binds.showBinds) collectFromExpr(out, bind.readExpr, allowed, source)
	for (const bind of binds.htmlBinds) collectFromExpr(out, bind.readExpr, allowed, source)
	for (const bind of binds.busyBinds) collectFromExpr(out, bind.readExpr, allowed, source)
	for (const bind of binds.classBinds) collectFromExpr(out, bind.readExpr, allowed, source)
	for (const bind of binds.propertyBinds) collectFromExpr(out, bind.readExpr, allowed, source)
	for (const bind of binds.attributeBinds) {
		for (const attr of bind.attributes) collectFromExpr(out, attr.readExpr, allowed, source)
	}
	for (const bind of binds.modelBinds) {
		collectFromExpr(out, bind.readExpr, allowed, source)
		collectFromExpr(out, bind.writeExpr, allowed, source, { initialShadows: MODEL_WRITE_SHADOWS })
	}
	for (const bind of binds.eventBinds) {
		collectFromExpr(out, bind.handlerExpr, allowed, source, {
			initialShadows: EVENT_HANDLER_SHADOWS,
		})
	}
	for (const bind of binds.ifBinds) {
		for (const branch of bind.branches) {
			if (branch.conditionExpr != null) {
				collectFromExpr(out, branch.conditionExpr, allowed, source)
			}
		}
	}
	for (const bind of binds.forBinds) {
		collectFromExpr(out, bind.itemsExpr, allowed, source)
		collectFromExpr(out, bind.keyExpr, allowed, source)
	}
	for (const bind of binds.switchBinds) {
		collectFromExpr(out, bind.expression, allowed, source)
		for (const branch of bind.cases) {
			for (const comparand of branch.comparandExprs) {
				collectFromExpr(out, comparand, allowed, source)
			}
		}
	}
	return out
}

/**
 * Collect all undeclared reactive-scope names (does not throw).
 */
export function collectReactiveScopeIssues(
	bodyIR: IRNode[],
	stateAnalysis: StateScriptAnalysisResult,
	stateScript: string,
	stateImports: readonly BuildScriptImport[],
	options: { diagnosticSource?: string } = {}
): ReactiveScopeIssue[] {
	const binds = collectReactiveBinds(bodyIR)
	const lowered = lowerStateScript(stateScript, stateAnalysis, stateImports)
	const ctx = withStructuralScopeNames(lowered.rewriteContext, binds)
	const allowed = buildAllowedNames(ctx)
	return collectFromBinds(binds, allowed, options.diagnosticSource)
}

function isReactiveBindingCompileError(err: unknown): err is CompileError {
	if (!(err instanceof CompileError)) return false
	return (
		err.message.includes('Unknown name `') ||
		err.message.includes('Reactive class binding') ||
		err.message.includes('must reference a declared state variable')
	)
}

/**
 * Source-level entry for IDE/CLI: lower the template and collect reactive binding issues.
 *
 * @remarks
 * Structural / state-script failures are ignored here (other checks own them). Lowerer
 * reactive class-binding throws are mapped into the result so IDE matches compile.
 */
export function collectReactiveBindingIssuesFromHtml(
	html: string,
	options: Pick<CompileOptions, 'root' | 'resolvePath' | 'importer' | 'reactivity' | 'hypermedia'>
): ReactiveScopeIssue[] {
	if (options.reactivity === false) return []
	const parsed = parse(html)
	if (!parsed.stateScript) return []

	const resolvePath = options.resolvePath ?? ((specifier: string) => specifier)
	const compileOptions: CompileOptions = {
		root: options.root,
		resolvePath,
		importer: options.importer,
		reactivity: options.reactivity,
		hypermedia: options.hypermedia,
		diagnosticTemplateSource: html,
	}
	const resolver = new Resolver({
		root: options.root,
		resolvePath,
		importer: options.importer,
	})
	const diag = { source: html, file: options.importer }

	try {
		const ta = buildTemplateAnalysis(parsed, compileOptions, resolver, diag)
		if (!ta.stateAnalysis) return []
		const stateImports = analyzeBuildScript(parsed.stateScript.content).imports
		return collectReactiveScopeIssues(
			ta.bodyIR,
			ta.stateAnalysis,
			parsed.stateScript.content,
			stateImports,
			{ diagnosticSource: html }
		)
	} catch (err) {
		if (isReactiveBindingCompileError(err)) {
			return [
				{
					message: err.message,
					name: '',
					expr: '',
					...(err.line !== undefined ? { line: err.line } : {}),
					...(err.column !== undefined ? { column: err.column } : {}),
				},
			]
		}
		return []
	}
}
