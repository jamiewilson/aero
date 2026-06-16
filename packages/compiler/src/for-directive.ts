/**
 * Parse `for` / `data-for` directive values as JavaScript `for…of` heads: `const … of …`.
 *
 * @remarks
 * Uses oxc-parser so destructuring and full binding patterns work without a custom DSL.
 */

import { parseSync } from 'oxc-parser'

const FOR_DIRECTIVE_FILE = 'for-directive.ts'
const FOR_DIRECTIVE_PARSE_OPTIONS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

export type ParsedForDirective = {
	/** Binding pattern text only (e.g. `item`, `{ name, id }`). */
	binding: string
	/** Iterable expression text (e.g. `items`, `site.nav`). */
	iterable: string
}

/** Loop metadata injected into each `for` / `data-for` body by codegen. */
export const FOR_LOOP_IMPLICIT_NAMES = ['index', 'first', 'last', 'length'] as const

const FOR_LOOP_IMPLICIT_NAME_SET = new Set<string>(FOR_LOOP_IMPLICIT_NAMES)

/** Binding names in a `for` head that shadow injected loop metadata. */
export function findForLoopImplicitNameShadows(inner: string): string[] {
	const names = collectForDirectiveBindingNames(inner)
	return names.filter(name => FOR_LOOP_IMPLICIT_NAME_SET.has(name)).sort()
}

type EstNode = {
	type: string
	start?: number
	end?: number
	name?: string
	left?: EstNode
	argument?: EstNode
	value?: EstNode
	properties?: EstNode[]
	elements?: (EstNode | null)[]
	declarations?: EstNode[]
	id?: EstNode
	init?: EstNode | null
	kind?: string
	await?: boolean
	[key: string]: unknown
}

function sliceRange(source: string, start?: number, end?: number): string {
	if (start === undefined || end === undefined) return ''
	return source.slice(start, end)
}

function wrapForDirective(inner: string): string {
	return `for (${inner}) {}`
}

function parseForDirectiveWrapped(wrapped: string) {
	return parseSync(FOR_DIRECTIVE_FILE, wrapped, FOR_DIRECTIVE_PARSE_OPTIONS)
}

function getFirstForOfStatement(result: ReturnType<typeof parseForDirectiveWrapped>): EstNode | undefined {
	const program = result.program as unknown as { body?: EstNode[] }
	const stmt = program.body?.[0]
	return stmt?.type === 'ForOfStatement' ? stmt : undefined
}

function getFirstForDeclarationId(stmt: EstNode): EstNode | undefined {
	const left = stmt.left as EstNode
	if (left.type !== 'VariableDeclaration') return undefined
	const decl0 = left.declarations?.[0] as EstNode | undefined
	if (!decl0?.id) return undefined
	return decl0.id as EstNode
}

function collectBindingIds(pattern: EstNode | null | undefined, out: Set<string>): void {
	collectPatternBindings(pattern, binding => out.add(binding.name))
}

/** Yields `{ name, start }` for each identifier bound by a destructuring/parameter pattern. */
export function collectPatternBindings(
	pattern: EstNode | null | undefined,
	onBinding: (binding: { name: string; start: number }) => void
): void {
	if (!pattern) return
	switch (pattern.type) {
		case 'Identifier':
			if (pattern.name) onBinding({ name: pattern.name, start: pattern.start ?? 0 })
			return
		case 'ObjectPattern':
			for (const prop of pattern.properties ?? []) {
				if (prop.type === 'Property') {
					collectPatternBindings(prop.value as EstNode, onBinding)
				} else if (prop.type === 'RestElement') {
					collectPatternBindings(prop.argument as EstNode, onBinding)
				}
			}
			return
		case 'ArrayPattern':
			for (const el of pattern.elements ?? []) {
				if (el) collectPatternBindings(el as EstNode, onBinding)
			}
			return
		case 'AssignmentPattern':
			collectPatternBindings(pattern.left as EstNode, onBinding)
			return
		case 'RestElement':
			collectPatternBindings(pattern.argument as EstNode, onBinding)
			return
		default:
			return
	}
}

/**
 * Parse a braced-stripped directive body (e.g. `const item of items`) as a `for…of` head.
 *
 * @throws Error with message if the text is not a valid `for (const … of …) {}` head.
 */
export function parseForDirective(inner: string): ParsedForDirective {
	const trimmed = inner.trim()
	if (!trimmed) {
		throw new Error('for directive value is empty')
	}

	const wrapped = wrapForDirective(trimmed)
	const result = parseForDirectiveWrapped(wrapped)

	if (result.errors.length > 0) {
		const first = result.errors[0]
		throw new Error(
			`for directive must be valid JavaScript: const … of …. ${first.message}${first.codeframe ? '\n' + first.codeframe : ''}`
		)
	}

	const stmt = getFirstForOfStatement(result)
	if (!stmt) {
		throw new Error('for directive must be a single for…of statement head: const … of …')
	}

	if (stmt.await) {
		throw new Error('for await…of is not supported in Aero templates')
	}

	const left = stmt.left as EstNode
	if (left.type !== 'VariableDeclaration') {
		throw new Error('for directive must use const (or let) with a binding: const … of …')
	}

	if (left.kind !== 'const' && left.kind !== 'let') {
		throw new Error('for directive must use const or let: const … of …')
	}

	const decl0 = left.declarations?.[0] as EstNode | undefined
	if (!decl0 || decl0.init != null) {
		throw new Error('for directive must not initialize the loop variable (use: const x of items)')
	}

	const id = decl0.id as EstNode
	const binding = sliceRange(wrapped, id.start, id.end)
	const right = stmt.right as EstNode
	const iterable = sliceRange(wrapped, right.start, right.end)

	return { binding, iterable }
}

/**
 * Collect bound identifier names from a `for` directive inner string (for editor scope / diagnostics).
 */
export function collectForDirectiveBindingNames(inner: string): string[] {
	const trimmed = inner.trim()
	if (!trimmed) return []

	const wrapped = wrapForDirective(trimmed)
	const result = parseForDirectiveWrapped(wrapped)
	if (result.errors.length > 0) return []

	const stmt = getFirstForOfStatement(result)
	if (!stmt) return []
	const id = getFirstForDeclarationId(stmt)
	if (!id) return []

	const out = new Set<string>()
	collectBindingIds(id, out)
	return [...out]
}
