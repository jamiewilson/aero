import { parseSync } from 'oxc-parser'
import type { BuildScriptImport } from './build-script-analysis'
import type { StateScriptAnalysisResult } from './state-script-analysis'

const FILENAME = 'scope-expr.ts'
const PARSE_OPTS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

const RESERVED = new Set([
	'scope',
	'actions',
	'event',
	'self',
	'$value',
	'escapeHtml',
	'__out',
	'true',
	'false',
	'null',
	'undefined',
	'this',
	'arguments',
	'typeof',
	'void',
	'delete',
	'new',
	'in',
	'instanceof',
	'String',
	'Number',
	'Boolean',
	'Array',
	'Object',
	'Math',
	'JSON',
	'Date',
	'parseInt',
	'parseFloat',
	'isNaN',
	'isFinite',
	'console',
	'alert',
	'Promise',
	'Map',
	'Set',
	'Symbol',
	'BigInt',
	'Error',
	'RegExp',
	'Intl',
	'Reflect',
	'Proxy',
	'crypto',
	'globalThis',
])

export const HYPERMEDIA_ACTION_NAMES = new Set(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'])

/** Shared rewrite environment for one page's is:state script. */
export interface ScopeRewriteContext {
	readonly scopeNames: ReadonlySet<string>
	readonly moduleScopeNames: ReadonlySet<string>
	readonly actionsNames?: ReadonlySet<string>
	readonly qualifyAllFreeIdentifiers: boolean
}

export interface ScopeRewriteCallOptions {
	initialShadows?: ReadonlySet<string>
	/** Per-call override; defaults to `ctx.actionsNames`. */
	actionsNames?: ReadonlySet<string>
}

/** @deprecated Prefer `ScopeRewriteContext` via `createScopeRewriteContext`. */
export interface LegacyScopeRewriteOptions {
	actionsNames?: ReadonlySet<string>
	qualifyAllFreeIdentifiers?: boolean
	moduleScopeNames?: ReadonlySet<string>
	initialShadows?: ReadonlySet<string>
}

function scopeRewriteContextFromLegacy(
	scopeNames: ReadonlySet<string>,
	options?: LegacyScopeRewriteOptions
): ScopeRewriteContext {
	return {
		scopeNames,
		moduleScopeNames: options?.moduleScopeNames ?? new Set(),
		actionsNames: options?.actionsNames,
		qualifyAllFreeIdentifiers: options?.qualifyAllFreeIdentifiers ?? false,
	}
}

export function createScopeRewriteContext(
	analysis: StateScriptAnalysisResult,
	stateImports: readonly BuildScriptImport[] = [],
	options?: { actionsNames?: ReadonlySet<string> }
): ScopeRewriteContext {
	const baseScopeNames = collectMountScopeNames(analysis, stateImports)
	const allModuleHelperNames = collectModuleHelperNames(analysis)
	const pureModuleHelpers = analysis.moduleHelpers.filter(
		helper => !moduleHelperNeedsScopeInstall(helper, baseScopeNames, allModuleHelperNames)
	)
	const scopeModuleHelpers = analysis.moduleHelpers.filter(helper =>
		moduleHelperNeedsScopeInstall(helper, baseScopeNames, allModuleHelperNames)
	)
	const scopeNames = new Set(baseScopeNames)
	for (const helper of scopeModuleHelpers) scopeNames.add(helper.name)
	const moduleScopeNames = new Set(pureModuleHelpers.map(helper => helper.name))
	return {
		scopeNames,
		moduleScopeNames,
		actionsNames: options?.actionsNames,
		qualifyAllFreeIdentifiers: true,
	}
}

type EstNode = {
	type: string
	start?: number
	end?: number
	name?: string
	left?: EstNode
	argument?: EstNode
	property?: EstNode
	key?: EstNode
	computed?: boolean
	shorthand?: boolean
	params?: EstNode[]
	body?: EstNode
	id?: EstNode
	label?: EstNode
	[key: string]: unknown
}

function nodeRange(node: EstNode): [number, number] | null {
	if (typeof node.start === 'number' && typeof node.end === 'number') return [node.start, node.end]
	return null
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

function collectPatternNames(pattern: EstNode | undefined, names: Set<string>): void {
	if (!pattern) return
	walkAst(pattern, node => {
		if (node.type === 'Identifier' && typeof node.name === 'string') names.add(node.name)
	})
}

function isMemberPropertyIdentifier(node: EstNode, parent?: EstNode): boolean {
	return (
		parent?.type === 'MemberExpression' &&
		parent.property === node &&
		parent.computed !== true
	)
}

function isObjectLiteralKeyIdentifier(node: EstNode, parent?: EstNode): boolean {
	return (
		parent?.type === 'Property' &&
		parent.key === node &&
		parent.computed !== true &&
		parent.shorthand !== true
	)
}

function isBindingIdentifier(node: EstNode, parent?: EstNode, key?: string): boolean {
	if (node.type !== 'Identifier') return false
	if (isMemberPropertyIdentifier(node, parent)) return false
	if (isObjectLiteralKeyIdentifier(node, parent)) return false
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

function collectRewrites(
	program: unknown,
	scopeNames: ReadonlySet<string>,
	actionsNames: ReadonlySet<string> | undefined,
	sourceOffset: number,
	moduleScopeNames?: ReadonlySet<string>,
	initialShadows?: ReadonlySet<string>
): Array<{ start: number; end: number; text: string }> {
	const rewrites: Array<{ start: number; end: number; text: string }> = []
	const shadowStack: Set<string>[] = [new Set(initialShadows)]

	function activeShadows(): Set<string> {
		const merged = new Set<string>()
		for (const layer of shadowStack) {
			for (const name of layer) merged.add(name)
		}
		return merged
	}

	function visitFunctionLike(node: EstNode): void {
		const layer = new Set<string>()
		for (const param of (node.params as EstNode[] | undefined) ?? []) {
			collectPatternNames(param, layer)
		}
		shadowStack.push(layer)
		walkAst(node.body, visit)
		shadowStack.pop()
	}

	function visit(node: EstNode, parent?: EstNode, key?: string): void | 'skip-children' {
		if (
			node.type === 'FunctionDeclaration' ||
			node.type === 'FunctionExpression' ||
			node.type === 'ArrowFunctionExpression'
		) {
			if (node.type === 'ArrowFunctionExpression' && node.body?.type !== 'BlockStatement') {
				const layer = new Set<string>()
				for (const param of (node.params as EstNode[] | undefined) ?? []) {
					collectPatternNames(param, layer)
				}
				shadowStack.push(layer)
				walkAst(node.body, visit)
				shadowStack.pop()
				return 'skip-children'
			}
			visitFunctionLike(node)
			return 'skip-children'
		}

		if (node.type === 'VariableDeclarator') {
			walkAst(node.init, visit, node, 'init')
			collectPatternNames(node.id, shadowStack[shadowStack.length - 1]!)
			return 'skip-children'
		}

		if (node.type === 'Property' && node.shorthand === true && node.key?.type === 'Identifier') {
			const name = node.key.name
			if (
				!RESERVED.has(name) &&
				!activeShadows().has(name) &&
				!moduleScopeNames?.has(name)
			) {
				const range = nodeRange(node)
				if (range) {
					if (actionsNames?.has(name)) {
						rewrites.push({
							start: range[0] - sourceOffset,
							end: range[1] - sourceOffset,
							text: `${name}: actions.${name}`,
						})
					} else if (scopeNames.has(name)) {
						rewrites.push({
							start: range[0] - sourceOffset,
							end: range[1] - sourceOffset,
							text: `${name}: scope.${name}`,
						})
					}
				}
			}
			return 'skip-children'
		}

		if (node.type === 'Identifier' && typeof node.name === 'string') {
			const name = node.name
			if (RESERVED.has(name)) return
			if (isMemberPropertyIdentifier(node, parent)) return
			if (isObjectLiteralKeyIdentifier(node, parent)) return
			if (isBindingIdentifier(node, parent, key)) return
			if (activeShadows().has(name)) return
			if (moduleScopeNames?.has(name)) return

			const range = nodeRange(node)
			if (!range) return

			if (actionsNames?.has(name)) {
				rewrites.push({
					start: range[0] - sourceOffset,
					end: range[1] - sourceOffset,
					text: `actions.${name}`,
				})
				return
			}
			if (scopeNames.has(name)) {
				rewrites.push({
					start: range[0] - sourceOffset,
					end: range[1] - sourceOffset,
					text: `scope.${name}`,
				})
			}
		}
	}

	walkAst(program, visit)
	return rewrites
}

function applyRewrites(source: string, rewrites: Array<{ start: number; end: number; text: string }>): string {
	if (rewrites.length === 0) return source
	let out = source
	for (const rewrite of [...rewrites].sort((a, b) => b.start - a.start)) {
		out = out.slice(0, rewrite.start) + rewrite.text + out.slice(rewrite.end)
	}
	return out
}

function parseWrappedExpression(expr: string): {
	program: unknown
	source: string
	offset: number
} | null {
	const source = `(${expr})`
	const parsed = parseSync(FILENAME, source, PARSE_OPTS)
	if (parsed.errors.length > 0) return null
	return { program: parsed.program, source: expr, offset: 1 }
}

function parseWrappedStatements(stmt: string): {
	program: unknown
	source: string
	offset: number
} | null {
	const trimmed = stmt.trim()
	const normalized = trimmed.endsWith(';') ? trimmed : `${trimmed};`
	const source = `function __aeroStmt() { ${normalized} }`
	const parsed = parseSync(FILENAME, source, PARSE_OPTS)
	if (parsed.errors.length > 0) return null
	const stmtStart = source.indexOf(trimmed)
	if (stmtStart < 0) return null
	return { program: parsed.program, source: trimmed, offset: stmtStart }
}

export function rewriteExprForScope(
	expr: string,
	ctx: ScopeRewriteContext,
	options?: ScopeRewriteCallOptions
): string
export function rewriteExprForScope(
	expr: string,
	scopeNames: ReadonlySet<string>,
	options?: LegacyScopeRewriteOptions
): string
export function rewriteExprForScope(
	expr: string,
	ctxOrScopeNames: ScopeRewriteContext | ReadonlySet<string>,
	options?: ScopeRewriteCallOptions | LegacyScopeRewriteOptions
): string {
	const ctx =
		ctxOrScopeNames instanceof Set
			? scopeRewriteContextFromLegacy(ctxOrScopeNames, options as LegacyScopeRewriteOptions | undefined)
			: ctxOrScopeNames
	return rewriteExprForScopeWithContext(expr, ctx, options)
}

function rewriteExprForScopeWithContext(
	expr: string,
	ctx: ScopeRewriteContext,
	options?: ScopeRewriteCallOptions
): string {
	const trimmed = expr.trim()
	if (!trimmed) return expr
	const wrapped = parseWrappedExpression(trimmed)
	if (!wrapped) return expr
	const effectiveScopeNames = ctx.qualifyAllFreeIdentifiers
		? mergeQualifyAllScopeNames(ctx.scopeNames, wrapped.program, wrapped.offset, ctx.moduleScopeNames)
		: ctx.scopeNames
	const rewrites = collectRewrites(
		wrapped.program,
		effectiveScopeNames,
		options?.actionsNames ?? ctx.actionsNames,
		wrapped.offset,
		ctx.moduleScopeNames,
		options?.initialShadows
	)
	return applyRewrites(wrapped.source, rewrites)
}

function mergeQualifyAllScopeNames(
	scopeNames: ReadonlySet<string>,
	program: unknown,
	sourceOffset: number,
	moduleScopeNames?: ReadonlySet<string>
): Set<string> {
	const names = new Set(scopeNames)
	collectFreeIdentifiers(program, sourceOffset).forEach(name => {
		if (!moduleScopeNames?.has(name)) names.add(name)
	})
	return names
}

export function collectFreeIdentifiers(program: unknown, sourceOffset: number): Set<string> {
	const names = new Set<string>()
	const shadowStack: Set<string>[] = [new Set()]

	function activeShadows(): Set<string> {
		const merged = new Set<string>()
		for (const layer of shadowStack) for (const name of layer) merged.add(name)
		return merged
	}

	function visit(node: EstNode, parent?: EstNode, key?: string): void | 'skip-children' {
		if (
			node.type === 'FunctionDeclaration' ||
			node.type === 'FunctionExpression' ||
			node.type === 'ArrowFunctionExpression'
		) {
			const layer = new Set<string>()
			for (const param of (node.params as EstNode[] | undefined) ?? []) {
				collectPatternNames(param, layer)
			}
			shadowStack.push(layer)
			if (node.type === 'ArrowFunctionExpression' && node.body?.type !== 'BlockStatement') {
				walkAst(node.body, visit)
			} else {
				walkAst(node.body, visit)
			}
			shadowStack.pop()
			return 'skip-children'
		}

		if (node.type === 'Identifier' && typeof node.name === 'string') {
			const name = node.name
			if (RESERVED.has(name)) return
			if (isMemberPropertyIdentifier(node, parent)) return
			if (isObjectLiteralKeyIdentifier(node, parent)) return
			if (isBindingIdentifier(node, parent, key)) return
			if (activeShadows().has(name)) return
			names.add(name)
		}
	}

	walkAst(program, visit)
	return names
}

export function rewriteStmtForScope(
	stmt: string,
	ctx: ScopeRewriteContext,
	options?: ScopeRewriteCallOptions
): string
export function rewriteStmtForScope(
	stmt: string,
	scopeNames: ReadonlySet<string>,
	options?: LegacyScopeRewriteOptions
): string
export function rewriteStmtForScope(
	stmt: string,
	ctxOrScopeNames: ScopeRewriteContext | ReadonlySet<string>,
	options?: ScopeRewriteCallOptions | LegacyScopeRewriteOptions
): string {
	const ctx =
		ctxOrScopeNames instanceof Set
			? scopeRewriteContextFromLegacy(ctxOrScopeNames, options as LegacyScopeRewriteOptions | undefined)
			: ctxOrScopeNames
	return rewriteStmtForScopeWithContext(stmt, ctx, options)
}

function rewriteStmtForScopeWithContext(
	stmt: string,
	ctx: ScopeRewriteContext,
	options?: ScopeRewriteCallOptions
): string {
	const trimmed = stmt.trim()
	if (!trimmed) return stmt
	const wrapped = parseWrappedStatements(trimmed)
	if (!wrapped) return stmt
	const effectiveScopeNames = ctx.qualifyAllFreeIdentifiers
		? mergeQualifyAllScopeNames(ctx.scopeNames, wrapped.program, wrapped.offset, ctx.moduleScopeNames)
		: ctx.scopeNames
	const rewrites = collectRewrites(
		wrapped.program,
		effectiveScopeNames,
		options?.actionsNames ?? ctx.actionsNames,
		wrapped.offset,
		ctx.moduleScopeNames,
		options?.initialShadows
	)
	return applyRewrites(wrapped.source, rewrites)
}

export function collectModuleHelperNames(analysis: StateScriptAnalysisResult): Set<string> {
	return new Set(analysis.moduleHelpers.map(helper => helper.name))
}

function parseModuleHelperInitializer(source: string): string | null {
	const match = /^const\s+\w+\s*=\s*(.+)$/s.exec(source.trim())
	return match?.[1]?.trim() ?? null
}

export function moduleHelperNeedsScopeInstall(
	helper: { name: string; source: string },
	scopeNames: ReadonlySet<string>,
	moduleScopeNames: ReadonlySet<string>
): boolean {
	const init = parseModuleHelperInitializer(helper.source)
	if (!init) return false
	const wrapped = parseWrappedExpression(init)
	if (!wrapped) return false
	const freeIds = collectFreeIdentifiers(wrapped.program, wrapped.offset)
	for (const id of freeIds) {
		if (scopeNames.has(id) && !moduleScopeNames.has(id)) return true
	}
	return false
}

export function rewriteModuleHelperForScope(
	helper: { name: string; source: string },
	scopeNames: ReadonlySet<string>,
	options?: {
		qualifyAllFreeIdentifiers?: boolean
		moduleScopeNames?: ReadonlySet<string>
	}
): string {
	const source = helper.source.trim()
	const parsed = parseSync(FILENAME, source, PARSE_OPTS)
	if (parsed.errors.length > 0) return helper.source

	let init: EstNode | undefined
	for (const stmt of (parsed.program as { body?: EstNode[] }).body ?? []) {
		const decl =
			stmt.type === 'ExportNamedDeclaration'
				? (stmt.declaration as EstNode | undefined)
				: stmt
		if (decl?.type !== 'VariableDeclaration' || decl.kind !== 'const') continue
		const declarator = (decl.declarations as EstNode[] | undefined)?.[0]
		if (!declarator) continue
		init = declarator.init as EstNode | undefined
		break
	}
	if (
		!init ||
		(init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression')
	) {
		return helper.source
	}

	const paramNames = new Set<string>()
	for (const param of (init.params as EstNode[] | undefined) ?? []) {
		if (param.type === 'Identifier' && typeof param.name === 'string') {
			paramNames.add(param.name)
			continue
		}
		walkAst(param, (node, parent, key) => {
			if (key === 'typeAnnotation' || key === 'typeParameters') return 'skip-children'
			if (
				node.type === 'Identifier' &&
				typeof node.name === 'string' &&
				isBindingIdentifier(node, parent, key)
			) {
				paramNames.add(node.name)
			}
		})
	}

	const rewriteOptions = {
		...options,
		initialShadows: paramNames,
	}

	if (
		init.type === 'ArrowFunctionExpression' &&
		init.body?.type !== 'BlockStatement'
	) {
		if (typeof init.body?.start !== 'number' || typeof init.body?.end !== 'number') {
			return helper.source
		}
		const bodySource = source.slice(init.body.start, init.body.end)
		const rewrittenBody = rewriteExprForScope(bodySource, scopeNames, rewriteOptions)
		const rewrittenInit =
			source.slice(init.start ?? 0, init.body.start) +
			rewrittenBody +
			source.slice(init.body.end, init.end ?? source.length)
		return `scope.${helper.name} = ${rewrittenInit.trim()}`
	}

	const body = init.body
	if (!body || body.type !== 'BlockStatement') return helper.source
	if (typeof body.start !== 'number' || typeof body.end !== 'number') return helper.source

	const inner = source.slice(body.start + 1, body.end - 1)
	const rewrittenInner = rewriteStmtForScope(inner, scopeNames, rewriteOptions)
	const rewrittenInit =
		source.slice(init.start ?? 0, body.start + 1) +
		rewrittenInner +
		source.slice(body.end - 1, init.end ?? source.length)
	return `scope.${helper.name} = ${rewrittenInit.trim()}`
}

export function collectMountScopeNames(
	analysis: StateScriptAnalysisResult,
	imports: readonly BuildScriptImport[] = []
): Set<string> {
	const names = new Set<string>()
	for (const binding of analysis.bindings) names.add(binding.name)
	for (const source of analysis.functionSources) {
		const match = /^function\s+(\w+)/.exec(source.trim())
		if (match) names.add(match[1]!)
	}
	for (const imp of imports) {
		if (imp.defaultBinding) names.add(imp.defaultBinding)
		for (const binding of imp.namedBindings) names.add(binding.local)
		if (imp.namespaceBinding) names.add(imp.namespaceBinding)
	}
	return names
}

export function rewriteFunctionSourceForScope(
	source: string,
	scopeNames: ReadonlySet<string>,
	options?: {
		qualifyAllFreeIdentifiers?: boolean
		moduleScopeNames?: ReadonlySet<string>
	}
): string {
	const parsed = parseSync(FILENAME, source.trim(), PARSE_OPTS)
	if (parsed.errors.length > 0) {
		return rewriteStmtForScope(source, scopeNames, options)
	}

	let fn: EstNode | undefined
	for (const stmt of (parsed.program as { body?: EstNode[] }).body ?? []) {
		const decl =
			stmt.type === 'ExportNamedDeclaration'
				? (stmt.declaration as EstNode | undefined)
				: stmt
		if (decl?.type === 'FunctionDeclaration') {
			fn = decl
			break
		}
	}
	if (!fn || fn.type !== 'FunctionDeclaration' || fn.id?.type !== 'Identifier') {
		return rewriteStmtForScope(source, scopeNames, options)
	}

	const name = fn.id.name!
	const paramNames = new Set<string>()
	for (const param of (fn.params as EstNode[] | undefined) ?? []) {
		if (param.type === 'Identifier' && typeof param.name === 'string') {
			paramNames.add(param.name)
			continue
		}
		walkAst(param, (node, parent, key) => {
			if (key === 'typeAnnotation' || key === 'typeParameters') return 'skip-children'
			if (
				node.type === 'Identifier' &&
				typeof node.name === 'string' &&
				isBindingIdentifier(node, parent, key)
			) {
				paramNames.add(node.name)
			}
		})
	}
	const body = fn.body
	if (!body || body.type !== 'BlockStatement') {
		return rewriteStmtForScope(source, scopeNames, options)
	}
	if (typeof body.start !== 'number' || typeof body.end !== 'number') {
		return rewriteStmtForScope(source, scopeNames, options)
	}

	const bodySource = source.trim().slice(body.start + 1, body.end - 1)
	const rewrittenBody = rewriteStmtForScope(bodySource, scopeNames, {
		...options,
		initialShadows: paramNames,
	})
	const params = [...paramNames].join(', ')
	return `scope.${name} = function(${params}) { ${rewrittenBody.trim()} }`
}
