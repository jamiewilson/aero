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
	'Aero',
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
])

export const HYPERMEDIA_ACTION_NAMES = new Set(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'])

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

function currentShadowLayer(shadowStack: Set<string>[]): Set<string> {
	return shadowStack[shadowStack.length - 1]!
}

function visitVariableDeclaration(
	node: EstNode,
	visit: (node: EstNode, parent?: EstNode, key?: string) => void | 'skip-children',
	shadowStack: Set<string>[]
): 'skip-children' {
	const layer = currentShadowLayer(shadowStack)
	for (const decl of (node.declarations as EstNode[] | undefined) ?? []) {
		walkAst(decl.init, visit)
		collectPatternNames(decl.id, layer)
	}
	return 'skip-children'
}

function collectRewrites(
	program: unknown,
	scopeNames: ReadonlySet<string>,
	actionsNames: ReadonlySet<string> | undefined,
	sourceOffset: number
): Array<{ start: number; end: number; text: string }> {
	const rewrites: Array<{ start: number; end: number; text: string }> = []
	const shadowStack: Set<string>[] = [new Set()]

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
		if (node.type === 'VariableDeclaration') {
			return visitVariableDeclaration(node, visit, shadowStack)
		}

		if (node.type === 'Property' && node.shorthand === true) {
			const keyNode = node.key as EstNode | undefined
			if (keyNode?.type === 'Identifier' && typeof keyNode.name === 'string') {
				const name = keyNode.name
				if (
					!RESERVED.has(name) &&
					!activeShadows().has(name) &&
					(scopeNames.has(name) || actionsNames?.has(name))
				) {
					const range = nodeRange(node)
					if (range) {
						const qualified = actionsNames?.has(name) ? `actions.${name}` : `scope.${name}`
						rewrites.push({
							start: range[0] - sourceOffset,
							end: range[1] - sourceOffset,
							text: `${name}: ${qualified}`,
						})
						return 'skip-children'
					}
				}
			}
		}

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

		if (node.type === 'Identifier' && typeof node.name === 'string') {
			const name = node.name
			if (RESERVED.has(name)) return
			if (isMemberPropertyIdentifier(node, parent)) return
			if (isObjectLiteralKeyIdentifier(node, parent)) return
			if (isBindingIdentifier(node, parent, key)) return
			if (activeShadows().has(name)) return

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
	const deduped: Array<{ start: number; end: number; text: string }> = []
	for (const rewrite of rewrites) {
		const prev = deduped[deduped.length - 1]
		if (prev && prev.start === rewrite.start && prev.end === rewrite.end) continue
		deduped.push(rewrite)
	}
	return deduped
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
	scopeNames: ReadonlySet<string>,
	options?: { actionsNames?: ReadonlySet<string>; qualifyAllFreeIdentifiers?: boolean }
): string {
	const trimmed = expr.trim()
	if (!trimmed) return expr
	const wrapped = parseWrappedExpression(trimmed)
	if (!wrapped) return expr
	const effectiveScopeNames = options?.qualifyAllFreeIdentifiers
		? mergeQualifyAllScopeNames(scopeNames, wrapped.program, wrapped.offset)
		: scopeNames
	const rewrites = collectRewrites(
		wrapped.program,
		effectiveScopeNames,
		options?.actionsNames,
		wrapped.offset
	)
	return applyRewrites(wrapped.source, rewrites)
}

function mergeQualifyAllScopeNames(
	scopeNames: ReadonlySet<string>,
	program: unknown,
	sourceOffset: number
): Set<string> {
	const names = new Set(scopeNames)
	collectFreeIdentifiers(program, sourceOffset).forEach(name => names.add(name))
	return names
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
		if (node.type === 'VariableDeclaration') {
			return visitVariableDeclaration(node, visit, shadowStack)
		}

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
	scopeNames: ReadonlySet<string>,
	options?: { actionsNames?: ReadonlySet<string>; qualifyAllFreeIdentifiers?: boolean }
): string {
	const trimmed = stmt.trim()
	if (!trimmed) return stmt
	const wrapped = parseWrappedStatements(trimmed)
	if (!wrapped) return stmt
	const effectiveScopeNames = options?.qualifyAllFreeIdentifiers
		? mergeQualifyAllScopeNames(scopeNames, wrapped.program, wrapped.offset)
		: scopeNames
	const rewrites = collectRewrites(
		wrapped.program,
		effectiveScopeNames,
		options?.actionsNames,
		wrapped.offset
	)
	return applyRewrites(wrapped.source, rewrites)
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
	scopeNames: ReadonlySet<string>
): string {
	const match = /^function\s+(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/.exec(source.trim())
	if (!match) return rewriteStmtForScope(source, scopeNames)
	const [, name, params, body] = match
	const rewrittenBody = rewriteStmtForScope(body, scopeNames)
	return `scope.${name} = function(${params}) { ${rewrittenBody} }`
}
