import { parseSync } from 'oxc-parser'
import type { BuildScriptImport } from './build-script-analysis'
import {
	collectScopeReferences,
	collectMountScopeNames,
	rewriteExprForScope,
	rewriteStmtForScope,
	HYPERMEDIA_ACTION_NAMES,
	type ScopeRewriteContext,
} from './scope-expr-codegen'
import type { StateScriptAnalysisResult } from './state-script-analysis'

const STATE_SCRIPT_FILENAME = 'state.ts'
const PARSE_OPTS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

type EstNode = {
	type: string
	start?: number
	end?: number
	name?: string
	id?: EstNode
	init?: EstNode
	body?: EstNode
	params?: EstNode[]
	declarations?: EstNode[]
	kind?: string
	expression?: EstNode
	[key: string]: unknown
}

export interface LoweredScopeFunction {
	readonly name: string
	/** CSP-safe install line: `scope.foo = ...` */
	readonly installSource: string
}

export interface LoweredStateScript {
	readonly moduleConstants: readonly string[]
	readonly scopeFunctions: readonly LoweredScopeFunction[]
	readonly rewriteContext: ScopeRewriteContext
}

function walkAst(
	node: unknown,
	visit: (node: EstNode, parent?: EstNode, key?: string) => void | 'skip-children',
	parent?: EstNode,
	key?: string
): void {
	if (!node || typeof node !== 'object') return
	const current = node as EstNode
	const result = visit(current, parent, key)
	if (result === 'skip-children') return
	for (const [childKey, value] of Object.entries(current)) {
		if (childKey === 'parent' || childKey === 'range') continue
		if (!value) continue
		if (Array.isArray(value)) {
			for (const item of value) walkAst(item, visit, current, childKey)
			continue
		}
		if (typeof value === 'object') walkAst(value, visit, current, childKey)
	}
}

function isBindingIdentifier(node: EstNode, parent?: EstNode, key?: string): boolean {
	if (node.type !== 'Identifier') return false
	if (parent?.type === 'MemberExpression' && parent.property === node && parent.computed !== true) {
		return false
	}
	if (
		parent?.type === 'Property' &&
		parent.key === node &&
		parent.computed !== true &&
		parent.shorthand !== true
	) {
		return false
	}
	if (parent?.type === 'LabeledStatement' && parent.label === node) return false
	if (parent?.type === 'VariableDeclarator' && parent.id === node) return true
	if (
		(parent?.type === 'FunctionDeclaration' ||
			parent?.type === 'FunctionExpression' ||
			parent?.type === 'ClassDeclaration') &&
		parent.id === node
	) {
		return true
	}
	if (
		(parent?.type === 'FunctionDeclaration' ||
			parent?.type === 'FunctionExpression' ||
			parent?.type === 'ArrowFunctionExpression') &&
		key === 'params'
	) {
		return true
	}
	if (parent?.type === 'CatchClause' && parent.param === node) return true
	return false
}

function collectParamNames(params: EstNode[] | undefined): Set<string> {
	const names = new Set<string>()
	for (const param of params ?? []) {
		if (param.type === 'Identifier' && typeof param.name === 'string') {
			names.add(param.name)
			continue
		}
		walkAst(param, (node, parent, key) => {
			if (key === 'typeAnnotation' || key === 'typeParameters') return 'skip-children'
			if (
				node.type === 'Identifier' &&
				typeof node.name === 'string' &&
				isBindingIdentifier(node, parent, key)
			) {
				names.add(node.name)
			}
		})
	}
	return names
}

function unwrapExpression(node: EstNode | undefined): EstNode | undefined {
	let current = node
	while (
		current?.type === 'TSAsExpression' ||
		current?.type === 'TSSatisfiesExpression' ||
		current?.type === 'TSNonNullExpression'
	) {
		current = current.expression as EstNode | undefined
	}
	return current
}

function isFunctionInitializer(init: EstNode | undefined): boolean {
	const expr = unwrapExpression(init)
	return expr?.type === 'ArrowFunctionExpression' || expr?.type === 'FunctionExpression'
}

function isAeroPropsExpression(node: EstNode | undefined): boolean {
	const expr = unwrapExpression(node)
	return (
		expr?.type === 'MemberExpression' &&
		(expr.object as EstNode | undefined)?.type === 'Identifier' &&
		(expr.object as EstNode).name === 'Aero' &&
		(expr.property as EstNode | undefined)?.type === 'Identifier' &&
		(expr.property as EstNode).name === 'props' &&
		expr.computed === false
	)
}

function isTypeOnlyStatement(stmt: EstNode): boolean {
	return stmt.type === 'TSTypeAliasDeclaration' || stmt.type === 'TSInterfaceDeclaration'
}

function isImportOrSkippedBinding(stmt: EstNode): boolean {
	if (stmt.type === 'ImportDeclaration') return true
	let declaration = stmt
	if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration) declaration = stmt.declaration as EstNode
	if (declaration.type === 'VariableDeclaration') {
		for (const d of declaration.declarations ?? []) {
			if (d.id?.type === 'ObjectPattern' && isAeroPropsExpression(d.init as EstNode)) return true
		}
	}
	return false
}

function bindingNamesFromAnalysis(analysis: StateScriptAnalysisResult): Set<string> {
	return new Set(analysis.bindings.map(binding => binding.name))
}

function functionInitReferencesScope(
	init: EstNode,
	baseScopeNames: ReadonlySet<string>,
	script: string
): boolean {
	if (typeof init.start !== 'number' || typeof init.end !== 'number') return false
	const slice = script.slice(init.start, init.end)
	const wrapped = `(${slice})`
	const parsed = parseSync('scope-fn.ts', wrapped, PARSE_OPTS)
	if (parsed.errors.length > 0) return false
	const scopeRefs = collectScopeReferences(parsed.program, 1, baseScopeNames)
	return scopeRefs.size > 0
}

function lowerScopeFunction(
	node: EstNode,
	name: string,
	source: string,
	ctx: ScopeRewriteContext
): string {
	const fn = unwrapExpression(node)
	if (!fn) return `scope.${name} = undefined`

	const rootStart = fn.start ?? 0
	const rel = (pos: number) => pos - rootStart
	const paramNames = collectParamNames(fn.params)
	const rewriteOptions = { initialShadows: paramNames }

	if (fn.type === 'ArrowFunctionExpression' && fn.body?.type !== 'BlockStatement') {
		if (typeof fn.body?.start !== 'number' || typeof fn.body?.end !== 'number') {
			return `scope.${name} = undefined`
		}
		const bodySource = source.slice(rel(fn.body.start), rel(fn.body.end))
		const rewrittenBody = rewriteExprForScope(bodySource, ctx, rewriteOptions)
		const rewrittenInit =
			source.slice(0, rel(fn.body.start)) + rewrittenBody + source.slice(rel(fn.body.end))
		return `scope.${name} = ${rewrittenInit.trim()}`
	}

	const body = fn.body
	if (!body || body.type !== 'BlockStatement') return `scope.${name} = undefined`
	if (typeof body.start !== 'number' || typeof body.end !== 'number') {
		return `scope.${name} = undefined`
	}

	const inner = source.slice(rel(body.start) + 1, rel(body.end) - 1)
	const rewrittenInner = rewriteStmtForScope(inner, ctx, rewriteOptions)
	const params = [...paramNames].join(', ')
	const asyncPrefix = fn.async === true ? 'async ' : ''

	if (fn.type === 'FunctionDeclaration' || fn.type === 'FunctionExpression') {
		return `scope.${name} = ${asyncPrefix}function(${params}) { ${rewrittenInner.trim()} }`
	}

	const rewrittenInit =
		source.slice(0, rel(body.start) + 1) + rewrittenInner + source.slice(rel(body.end) - 1)
	return `scope.${name} = ${rewrittenInit.trim()}`
}

function buildRewriteContext(
	analysis: StateScriptAnalysisResult,
	stateImports: readonly BuildScriptImport[],
	scopeInstalledNames: ReadonlySet<string>,
	moduleScopeNames: ReadonlySet<string>
): ScopeRewriteContext {
	const scopeNames = new Set(collectMountScopeNames(analysis, stateImports))
	for (const name of scopeInstalledNames) scopeNames.add(name)
	for (const name of HYPERMEDIA_ACTION_NAMES) scopeNames.add(name)
	return {
		scopeNames,
		moduleScopeNames,
	}
}

export function lowerStateScript(
	script: string,
	analysis: StateScriptAnalysisResult,
	stateImports: readonly BuildScriptImport[] = []
): LoweredStateScript {
	if (!script.trim()) {
		return {
			moduleConstants: [],
			scopeFunctions: [],
			rewriteContext: buildRewriteContext(analysis, stateImports, new Set(), new Set()),
		}
	}

	const parsed = parseSync(STATE_SCRIPT_FILENAME, script, PARSE_OPTS)
	const baseScopeNames = collectMountScopeNames(analysis, stateImports)
	const bindingNames = bindingNamesFromAnalysis(analysis)
	const moduleConstants: string[] = []
	const scopeFunctionNodes: Array<{ name: string; node: EstNode; source: string }> = []
	const moduleScopeNames = new Set<string>()

	for (const stmt of (parsed.program as unknown as { body?: EstNode[] }).body ?? []) {
		if (isImportOrSkippedBinding(stmt)) continue
		if (isTypeOnlyStatement(stmt)) continue

		let declaration = stmt
		if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration) {
			declaration = stmt.declaration as EstNode
		}

		if (declaration.type === 'FunctionDeclaration') {
			if (declaration.id?.type !== 'Identifier' || typeof declaration.id.name !== 'string') continue
			if (typeof declaration.start !== 'number' || typeof declaration.end !== 'number') continue
			scopeFunctionNodes.push({
				name: declaration.id.name,
				node: declaration,
				source: script.slice(declaration.start, declaration.end),
			})
			continue
		}

		if (declaration.type !== 'VariableDeclaration' || declaration.kind !== 'const') continue

		for (const declarator of declaration.declarations ?? []) {
			if (declarator.id?.type !== 'Identifier' || typeof declarator.id.name !== 'string') continue
			const name = declarator.id.name
			if (bindingNames.has(name)) continue
			if (!declarator.init) continue

			if (isFunctionInitializer(declarator.init as EstNode)) {
				const init = unwrapExpression(declarator.init as EstNode)!
				if (typeof init.start !== 'number' || typeof init.end !== 'number') continue
				const initSource = script.slice(init.start, init.end)
				if (functionInitReferencesScope(init, baseScopeNames, script)) {
					scopeFunctionNodes.push({
						name,
						node: init,
						source: initSource,
					})
				} else {
					moduleScopeNames.add(name)
					moduleConstants.push(`const ${name} = ${initSource}`)
				}
				continue
			}

			if (typeof declarator.init.start !== 'number' || typeof declarator.init.end !== 'number') continue
			moduleConstants.push(
				`const ${name} = ${script.slice(declarator.init.start, declarator.init.end)}`
			)
		}
	}

	const scopeInstalledNames = new Set(scopeFunctionNodes.map(fn => fn.name))
	const rewriteContext = buildRewriteContext(
		analysis,
		stateImports,
		scopeInstalledNames,
		moduleScopeNames
	)
	const scopeFunctions = scopeFunctionNodes.map(({ name, node, source }) => ({
		name,
		installSource: lowerScopeFunction(node, name, source, rewriteContext),
	}))

	return { moduleConstants, scopeFunctions, rewriteContext }
}

/** Names visible to template binds and handlers from bindings plus lowered declarations. */
export function collectStateReferenceNames(
	script: string,
	analysis: StateScriptAnalysisResult,
	stateImports: readonly BuildScriptImport[] = []
): Set<string> {
	const names = new Set<string>()
	for (const binding of analysis.bindings) names.add(binding.name)
	if (!script.trim()) return names

	const lowered = lowerStateScript(script, analysis, stateImports)
	for (const fn of lowered.scopeFunctions) names.add(fn.name)
	for (const line of lowered.moduleConstants) {
		const match = /^const\s+(\w+)\s*=/.exec(line.trim())
		if (match) names.add(match[1]!)
	}
	return names
}
