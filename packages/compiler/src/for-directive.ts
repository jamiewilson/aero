/**
 * Parse `for` / `data-for` directive values as JavaScript `for…of` heads: `const … of …`.
 *
 * @remarks
 * Uses oxc-parser so destructuring and full binding patterns work without a custom DSL.
 */

import { parseSync } from 'oxc-parser'

const FOR_DIRECTIVE_FILE = 'for-directive.ts'

export type ParsedForDirective = {
	/** Binding pattern text only (e.g. `item`, `{ name, id }`). */
	binding: string
	/** Iterable expression text (e.g. `items`, `site.nav`). */
	iterable: string
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

function collectBindingIds(pattern: EstNode | null | undefined, out: Set<string>): void {
	if (!pattern) return
	switch (pattern.type) {
		case 'Identifier':
			if (pattern.name) out.add(pattern.name)
			return
		case 'ObjectPattern':
			for (const prop of pattern.properties ?? []) {
				if (prop.type === 'Property') {
					const v = prop.value as EstNode
					collectBindingIds(v, out)
				} else if (prop.type === 'RestElement') {
					collectBindingIds(prop.argument as EstNode, out)
				}
			}
			return
		case 'ArrayPattern':
			for (const el of pattern.elements ?? []) {
				if (el) collectBindingIds(el as EstNode, out)
			}
			return
		case 'AssignmentPattern':
			collectBindingIds(pattern.left as EstNode, out)
			return
		case 'RestElement':
			collectBindingIds(pattern.argument as EstNode, out)
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

	const wrapped = `for (${trimmed}) {}`

	const result = parseSync(FOR_DIRECTIVE_FILE, wrapped, {
		sourceType: 'module',
		range: true,
		lang: 'ts',
	})

	if (result.errors.length > 0) {
		const first = result.errors[0]
		throw new Error(
			`for directive must be valid JavaScript: const … of …. ${first.message}${first.codeframe ? '\n' + first.codeframe : ''}`
		)
	}

	const program = result.program as unknown as { body?: EstNode[] }
	const stmt = program.body?.[0]
	if (!stmt || stmt.type !== 'ForOfStatement') {
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

	const wrapped = `for (${trimmed}) {}`
	const result = parseSync(FOR_DIRECTIVE_FILE, wrapped, {
		sourceType: 'module',
		range: true,
		lang: 'ts',
	})
	if (result.errors.length > 0) return []

	const program = result.program as unknown as { body?: EstNode[] }
	const stmt = program.body?.[0]
	if (!stmt || stmt.type !== 'ForOfStatement') return []

	const left = stmt.left as EstNode
	if (left.type !== 'VariableDeclaration') return []
	const decl0 = left.declarations?.[0] as EstNode | undefined
	if (!decl0?.id) return []

	const out = new Set<string>()
	collectBindingIds(decl0.id as EstNode, out)
	return [...out]
}
