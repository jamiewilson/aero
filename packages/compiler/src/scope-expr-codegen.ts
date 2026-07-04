import { parseSync } from 'oxc-parser'
import {
	HYPERMEDIA_EVENT_HANDLER_ACTION_SET,
	HYPERMEDIA_HTTP_METHOD_SET,
} from './event-handler-action-scope'
import type { BuildScriptImport } from './build-script-analysis'
import type { StateScriptAnalysisResult } from './state-script-analysis'

const FILENAME = 'scope-expr.ts'
const PARSE_OPTS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

export const HYPERMEDIA_ACTION_NAMES = HYPERMEDIA_HTTP_METHOD_SET

/** @deprecated Prefer `HYPERMEDIA_EVENT_HANDLER_ACTION_SET` from `@aero-js/compiler`. */
export const HYPERMEDIA_HANDLER_ACTION_NAMES = HYPERMEDIA_EVENT_HANDLER_ACTION_SET

/** Params injected into generated event handler signatures. */
export const EVENT_HANDLER_SHADOWS = new Set(['event', 'self'])

/** Params injected into generated model write handler signatures. */
export const MODEL_WRITE_SHADOWS = new Set(['$value'])

/** Mount-injected scope names rewritten to `scope.<name>` in compiled handlers/effects. */
export const MOUNT_SCOPE_BUILTINS = new Set(['$root'])

/** Shared rewrite environment for one page's is:state script. */
export interface ScopeRewriteContext {
	readonly scopeNames: ReadonlySet<string>
	readonly moduleScopeNames: ReadonlySet<string>
	readonly actionsNames?: ReadonlySet<string>
}

export interface ScopeRewriteCallOptions {
	initialShadows?: ReadonlySet<string>
	/** Per-call override; defaults to `ctx.actionsNames`. */
	actionsNames?: ReadonlySet<string>
}

export function scopeRewriteContext(
	scopeNames: ReadonlySet<string>,
	options?: {
		moduleScopeNames?: ReadonlySet<string>
		actionsNames?: ReadonlySet<string>
	}
): ScopeRewriteContext {
	return {
		scopeNames,
		moduleScopeNames: options?.moduleScopeNames ?? new Set(),
		actionsNames: options?.actionsNames,
	}
}

export function createScopeRewriteContext(
	analysis: StateScriptAnalysisResult,
	stateImports: readonly BuildScriptImport[] = [],
	options?: {
		actionsNames?: ReadonlySet<string>
		extraScopeNames?: ReadonlySet<string>
		moduleScopeNames?: ReadonlySet<string>
	}
): ScopeRewriteContext {
	const scopeNames = new Set(collectMountScopeNames(analysis, stateImports))
	for (const name of options?.extraScopeNames ?? []) scopeNames.add(name)
	return {
		scopeNames,
		moduleScopeNames: options?.moduleScopeNames ?? new Set(),
		actionsNames: options?.actionsNames,
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
	return parent?.type === 'MemberExpression' && parent.property === node && parent.computed !== true
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
				typeof name === 'string' &&
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

function applyRewrites(
	source: string,
	rewrites: Array<{ start: number; end: number; text: string }>
): string {
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
	if (!trimmed) return null
	const normalized = trimmed.endsWith(';') ? trimmed : `${trimmed};`
	for (const asyncFn of [false, true] as const) {
		const prefix = asyncFn ? 'async function __aeroStmt() { ' : 'function __aeroStmt() { '
		const source = `${prefix}${normalized} }`
		const parsed = parseSync(FILENAME, source, PARSE_OPTS)
		if (parsed.errors.length > 0) continue
		const stmtStart = source.indexOf(trimmed)
		if (stmtStart < 0) continue
		return { program: parsed.program, source: trimmed, offset: stmtStart }
	}
	return null
}

export function rewriteExprForScope(
	expr: string,
	ctx: ScopeRewriteContext,
	options?: ScopeRewriteCallOptions
): string {
	const trimmed = expr.trim()
	if (!trimmed) return expr
	const wrapped = parseWrappedExpression(trimmed)
	if (!wrapped) return expr
	const rewrites = collectRewrites(
		wrapped.program,
		ctx.scopeNames,
		options?.actionsNames ?? ctx.actionsNames,
		wrapped.offset,
		ctx.moduleScopeNames,
		options?.initialShadows
	)
	return applyRewrites(wrapped.source, rewrites)
}

function collectFreeIdentifiers(program: unknown, sourceOffset: number): Set<string> {
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

/** Free identifiers in `program` that reference known scope names. */
export function collectScopeReferences(
	program: unknown,
	sourceOffset: number,
	scopeNames: ReadonlySet<string>
): Set<string> {
	const refs = new Set<string>()
	for (const name of collectFreeIdentifiers(program, sourceOffset)) {
		if (scopeNames.has(name)) refs.add(name)
	}
	return refs
}

export function rewriteStmtForScope(
	stmt: string,
	ctx: ScopeRewriteContext,
	options?: ScopeRewriteCallOptions
): string {
	const trimmed = stmt.trim()
	if (!trimmed) return stmt
	const wrapped = parseWrappedStatements(trimmed)
	if (!wrapped) return stmt
	const rewrites = collectRewrites(
		wrapped.program,
		ctx.scopeNames,
		options?.actionsNames ?? ctx.actionsNames,
		wrapped.offset,
		ctx.moduleScopeNames,
		options?.initialShadows
	)
	return applyRewrites(wrapped.source, rewrites)
}

export function collectMountScopeNames(
	analysis: StateScriptAnalysisResult,
	imports: readonly BuildScriptImport[] = []
): Set<string> {
	const names = new Set<string>(MOUNT_SCOPE_BUILTINS)
	for (const binding of analysis.bindings) names.add(binding.name)
	for (const imp of imports) {
		if (imp.defaultBinding) names.add(imp.defaultBinding)
		for (const binding of imp.namedBindings) names.add(binding.local)
		if (imp.namespaceBinding) names.add(imp.namespaceBinding)
	}
	return names
}
