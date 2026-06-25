/**
 * Virtual TS shaping for `<script is:state>` editor checking.
 *
 * @remarks
 * Full module type-checking narrows `let x = literal` bindings; writable state must stay
 * assignable across reactive updates. Inserts explicit type annotations and initializer
 * assertions on top-level `let` bindings in virtual text only (source HTML is unchanged).
 */

import { parseSync } from 'oxc-parser'

export type StateScriptTextMapping = {
	readonly text: string
	readonly segments: ReadonlyArray<{
		readonly sourceStart: number
		readonly sourceLength: number
		readonly generatedStart: number
	}>
}

const STATE_SCRIPT_FILENAME = 'state.ts'
const STATE_SCRIPT_PARSE_OPTIONS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

function isStringLiteralNode(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false
	const n = node as { type?: string; value?: unknown }
	if (n.type === 'StringLiteral') return true
	return n.type === 'Literal' && typeof n.value === 'string'
}

function typeAnnotationForInit(init: unknown): string {
	if (!init || typeof init !== 'object') return 'any'
	const node = init as {
		type?: string
		object?: { type?: string; name?: string }
		consequent?: unknown
		alternate?: unknown
	}
	switch (node.type) {
		case 'NumericLiteral':
			return 'number'
		case 'StringLiteral':
			return 'string'
		case 'BooleanLiteral':
			return 'boolean'
		case 'Literal': {
			const value = (node as { value?: unknown }).value
			if (typeof value === 'string') return 'string'
			if (typeof value === 'number') return 'number'
			if (typeof value === 'boolean') return 'boolean'
			return 'any'
		}
		case 'MemberExpression':
			if (node.object?.type === 'Identifier' && node.object.name) {
				return node.object.name
			}
			return 'any'
		case 'ConditionalExpression':
			if (isStringLiteralNode(node.consequent) && isStringLiteralNode(node.alternate)) {
				return 'string'
			}
			return 'any'
		default:
			return 'any'
	}
}

function wholeScriptMapping(script: string): StateScriptTextMapping {
	return {
		text: script,
		segments: [{ sourceStart: 0, sourceLength: script.length, generatedStart: 0 }],
	}
}

function topLevelLetDeclarators(program: unknown): Array<{
	name: string
	idEnd: number
	init: unknown
	initEnd: number | null
}> {
	const out: Array<{ name: string; idEnd: number; init: unknown; initEnd: number | null }> = []
	for (const stmt of (program as { body?: unknown[] })?.body ?? []) {
		let declaration = stmt as {
			type?: string
			kind?: string
			declaration?: { type?: string; kind?: string; declarations?: unknown[] }
			declarations?: unknown[]
		}
		if (declaration?.type === 'ExportNamedDeclaration' && declaration.declaration) {
			declaration = declaration.declaration
		}
		if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'let') continue
		for (const d of declaration.declarations ?? []) {
			const decl = d as {
				id?: { type?: string; name?: string; end?: number }
				init?: unknown
			}
			if (decl.id?.type !== 'Identifier' || typeof decl.id.name !== 'string') continue
			if (typeof decl.id.end !== 'number') continue
			const init = decl.init as { end?: number } | null | undefined
			const initEnd = init && typeof init.end === 'number' ? init.end : null
			out.push({ name: decl.id.name, idEnd: decl.id.end, init: decl.init, initEnd })
		}
	}
	return out
}

function isAeroPropsExpression(node: unknown): boolean {
	const expr = node as {
		type?: string
		object?: { type?: string; name?: string }
		property?: { type?: string; name?: string }
		computed?: boolean
	}
	return (
		expr?.type === 'MemberExpression' &&
		expr.object?.type === 'Identifier' &&
		expr.object.name === 'Aero' &&
		expr.property?.type === 'Identifier' &&
		expr.property.name === 'props' &&
		expr.computed === false
	)
}

function topLevelAeroPropsConstDeclarations(program: unknown): Array<{ start: number; length: number }> {
	const out: Array<{ start: number; length: number }> = []
	for (const stmt of (program as { body?: unknown[] })?.body ?? []) {
		let declaration = stmt as {
			type?: string
			kind?: string
			start?: number
			declaration?: {
				type?: string
				kind?: string
				start?: number
				declarations?: unknown[]
			}
			declarations?: unknown[]
		}
		if (declaration?.type === 'ExportNamedDeclaration' && declaration.declaration) {
			declaration = declaration.declaration
		}
		if (
			declaration?.type !== 'VariableDeclaration' ||
			declaration.kind !== 'const' ||
			typeof declaration.start !== 'number'
		) {
			continue
		}
		const hasAeroPropsPattern = (declaration.declarations ?? []).some(d => {
			const decl = d as { id?: { type?: string }; init?: unknown }
			return decl.id?.type === 'ObjectPattern' && isAeroPropsExpression(decl.init)
		})
		if (hasAeroPropsPattern) out.push({ start: declaration.start, length: 'const'.length })
	}
	return out
}

/**
 * Insert `: Type` after top-level `let` binding names for editor virtual TS.
 */
export function annotateStateScriptForEditorTypecheck(script: string): StateScriptTextMapping {
	if (!script.trim()) return wholeScriptMapping(script)

	const parsed = parseSync(STATE_SCRIPT_FILENAME, script, STATE_SCRIPT_PARSE_OPTIONS)
	if (parsed.errors.length > 0) return wholeScriptMapping(script)

	const insertions: Array<{ pos: number; text: string; deleteLength?: number }> = []
	for (const declaration of topLevelAeroPropsConstDeclarations(parsed.program)) {
		insertions.push({ pos: declaration.start, text: 'let', deleteLength: declaration.length })
	}
	for (const decl of topLevelLetDeclarators(parsed.program)) {
		const typeAnn = typeAnnotationForInit(decl.init)
		insertions.push({ pos: decl.idEnd, text: `: ${typeAnn}` })
		if (typeAnn !== 'any' && decl.initEnd != null) {
			insertions.push({ pos: decl.initEnd, text: ` as ${typeAnn}` })
		}
	}
	if (insertions.length === 0) return wholeScriptMapping(script)

	insertions.sort((a, b) => a.pos - b.pos)

	let generated = ''
	let sourceCursor = 0
	let generatedCursor = 0
	const segments: StateScriptTextMapping['segments'][number][] = []

	for (const insertion of insertions) {
		if (sourceCursor < insertion.pos) {
			const slice = script.slice(sourceCursor, insertion.pos)
			segments.push({
				sourceStart: sourceCursor,
				sourceLength: slice.length,
				generatedStart: generatedCursor,
			})
			generated += slice
			generatedCursor += slice.length
			sourceCursor = insertion.pos
		}
		generated += insertion.text
		generatedCursor += insertion.text.length
		sourceCursor += insertion.deleteLength ?? 0
	}

	if (sourceCursor < script.length) {
		const slice = script.slice(sourceCursor)
		segments.push({
			sourceStart: sourceCursor,
			sourceLength: slice.length,
			generatedStart: generatedCursor,
		})
		generated += slice
	}

	return { text: generated, segments }
}
