/**
 * Build-script value bindings for Aero tooling (language server ambient decls, VS Code diagnostics).
 *
 * @remarks {@link iterateBuildScriptBindings} is the single implementation; consumers derive names or full ranges from it.
 */
import {
	analyzeBuildScriptForEditor,
	extractBuildScriptTypeDeclarationTexts,
} from './build-script-analysis'
import { collectBindingTypeStringsFromBuildScripts } from './build-script-type-inference'
import { collectPatternBindings } from './for-directive'
import { parseSync } from 'oxc-parser'

const SIMPLE_DECL_REGEX =
	/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w.$<>,\s[\]|{}]+)?\s*=\s*(\{[\s\S]*?\})?/g
const DESTRUCTURING_DECL_REGEX = /\b(?:const|let|var)\s+\{([^}]+)\}\s*=/g
const FUNCTION_DECL_REGEX = /\bfunction\s+\*?\s*([A-Za-z_$][\w$]*)\s*\(/g

function maskJsComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, match => ' '.repeat(match.length))
}

function collectObjectLiteralKeys(initializer: string): Set<string> {
	const properties = new Set<string>()
	const keyRegex = /([A-Za-z_$][\w$]*)\s*:/g
	let keyMatch: RegExpExecArray | null
	while ((keyMatch = keyRegex.exec(initializer)) !== null) {
		properties.add(keyMatch[1])
	}
	const shorthandRegex = /(?:\{|,)\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g
	while ((keyMatch = shorthandRegex.exec(initializer)) !== null) {
		properties.add(keyMatch[1])
	}
	return properties
}

export type BuildScriptBindingKind = 'import' | 'declaration' | 'function'

export type BuildScriptBinding = {
	name: string
	/** Offset in `content` (0-based, inclusive). */
	start: number
	/** Offset in `content` (exclusive). */
	end: number
	kind: BuildScriptBindingKind
	/** Set when a simple declaration uses an object literal initializer. */
	properties?: ReadonlySet<string>
}

export type IterateBuildScriptBindingsOptions = {
	/**
	 * Omit static import bindings (e.g. inline scripts where import analysis is skipped).
	 */
	skipImports?: boolean
	/**
	 * Include arrow/callback params, for-of loop vars, and catch bindings.
	 * Use for client-script undefined checks only — not build-script module scope.
	 */
	includeNestedBindings?: boolean
}

function toBinding(
	name: string,
	start: number,
	kind: BuildScriptBindingKind,
	properties?: ReadonlySet<string>
): BuildScriptBinding {
	return {
		name,
		start,
		end: start + name.length,
		kind,
		...(properties && properties.size > 0 ? { properties } : {}),
	}
}

function* iterateImportBindings(content: string): Generator<BuildScriptBinding> {
	try {
		const { imports } = analyzeBuildScriptForEditor(content)
		for (const imp of imports) {
			const bindingRanges = imp.bindingRanges ?? {}
			for (const [localName, range] of Object.entries(bindingRanges)) {
				if (!localName) continue
				const [start] = range as [number, number]
				yield toBinding(localName, start, 'import')
			}
		}
	} catch {
		// Parse errors: regex passes below may still find declarations.
	}
}

function* iterateSimpleDeclarationBindings(maskedContent: string): Generator<BuildScriptBinding> {
	const simpleDeclRegex = new RegExp(SIMPLE_DECL_REGEX)
	let declMatch: RegExpExecArray | null
	while ((declMatch = simpleDeclRegex.exec(maskedContent)) !== null) {
		const name = declMatch[1]
		const initializer = declMatch[2]
		const nameOffsetInFullMatch = declMatch[0].indexOf(name)
		const start = declMatch.index + nameOffsetInFullMatch
		const properties = initializer ? collectObjectLiteralKeys(initializer) : undefined
		yield toBinding(name, start, 'declaration', properties)
	}
}

function stripDestructuringDefault(pattern: string): string {
	let depth = 0
	for (let i = 0; i < pattern.length; i++) {
		const ch = pattern[i]
		if (ch === '{' || ch === '[' || ch === '(') depth++
		else if (ch === '}' || ch === ']' || ch === ')') depth--
		else if (ch === '=' && depth === 0) return pattern.slice(0, i).trim()
	}
	return pattern
}

function destructuringPartLocalName(part: string): string {
	const trimmed = part.trim()
	if (!trimmed) return ''

	const withoutDefault = stripDestructuringDefault(trimmed)
	const colonIndex = withoutDefault.indexOf(':')
	if (colonIndex > -1) {
		return withoutDefault.slice(colonIndex + 1).trim()
	}
	return withoutDefault
}

function* iterateDestructuringBindings(maskedContent: string): Generator<BuildScriptBinding> {
	const destructuringRegex = new RegExp(DESTRUCTURING_DECL_REGEX)
	let declMatch: RegExpExecArray | null
	while ((declMatch = destructuringRegex.exec(maskedContent)) !== null) {
		const body = declMatch[1]
		const bodyStart = declMatch.index + declMatch[0].indexOf(body)

		const parts = body.split(',')
		let currentOffset = 0
		for (const part of parts) {
			const localName = destructuringPartLocalName(part)
			if (!localName) {
				currentOffset += part.length + 1
				continue
			}

			const partIndex = body.indexOf(part, currentOffset)
			const localIndex = part.lastIndexOf(localName)
			const absStart = bodyStart + partIndex + localIndex

			yield toBinding(localName, absStart, 'declaration')
			currentOffset = partIndex + part.length
		}
	}
}

function* iterateFunctionBindings(maskedContent: string): Generator<BuildScriptBinding> {
	const fnRegex = new RegExp(FUNCTION_DECL_REGEX)
	let fnMatch: RegExpExecArray | null
	while ((fnMatch = fnRegex.exec(maskedContent)) !== null) {
		const name = fnMatch[1]
		const start = fnMatch.index + fnMatch[0].indexOf(name)
		yield toBinding(name, start, 'function')
	}
}

type EstNode = {
	type: string
	start?: number
	name?: string
	params?: EstNode[]
	left?: EstNode
	param?: EstNode
	argument?: EstNode
	value?: EstNode
	properties?: EstNode[]
	elements?: (EstNode | null)[]
	declarations?: EstNode[]
	id?: EstNode
	body?: EstNode
	[key: string]: unknown
}

const NESTED_SCRIPT_PARSE_OPTIONS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

function recordPatternBindings(
	pattern: EstNode | null | undefined,
	kind: BuildScriptBindingKind,
	yieldBinding: (binding: BuildScriptBinding) => void
): void {
	collectPatternBindings(pattern, ({ name, start }) => {
		yieldBinding(toBinding(name, start, kind))
	})
}

function walkNestedScriptBindings(node: EstNode, yieldBinding: (binding: BuildScriptBinding) => void): void {
	switch (node.type) {
		case 'ArrowFunctionExpression':
		case 'FunctionExpression':
			for (const param of node.params ?? []) {
				recordPatternBindings(param, 'declaration', yieldBinding)
			}
			break
		case 'ForOfStatement':
		case 'ForInStatement': {
			const left = node.left as EstNode | undefined
			if (left?.type === 'VariableDeclaration') {
				for (const decl of left.declarations ?? []) {
					recordPatternBindings(decl.id as EstNode, 'declaration', yieldBinding)
				}
			}
			break
		}
		case 'CatchClause':
			recordPatternBindings(node.param as EstNode, 'declaration', yieldBinding)
			break
		default:
			break
	}

	for (const key of Object.keys(node)) {
		if (key === 'type' || key === 'start' || key === 'end' || key === 'name' || key === 'kind') continue
		const value = node[key]
		if (Array.isArray(value)) {
			for (const item of value) {
				if (item && typeof item === 'object' && 'type' in item) {
					walkNestedScriptBindings(item as EstNode, yieldBinding)
				}
			}
			continue
		}
		if (value && typeof value === 'object' && 'type' in value) {
			walkNestedScriptBindings(value as EstNode, yieldBinding)
		}
	}
}

function* iterateNestedScriptBindings(content: string): Generator<BuildScriptBinding> {
	if (!content.trim()) return

	let result: ReturnType<typeof parseSync>
	try {
		result = parseSync('script.ts', content, NESTED_SCRIPT_PARSE_OPTIONS)
	} catch {
		return
	}
	if (result.errors.length > 0) return

	const body = (result.program as unknown as { body?: EstNode[] }).body
	if (!body) return

	const bindings: BuildScriptBinding[] = []
	const seen = new Set<string>()

	for (const stmt of body) {
		walkNestedScriptBindings(stmt, binding => {
			if (seen.has(binding.name)) return
			seen.add(binding.name)
			bindings.push(binding)
		})
	}

	yield* bindings
}

/**
 * Yields value-like bindings in document order: imports, simple const/let/var, destructuring, then `function` declarations.
 * Uses comment-masking + regex passes as a lightweight fallback when full parse data is unavailable.
 *
 * @param content - Inner text of a `<script>` block.
 */
export function* iterateBuildScriptBindings(
	content: string,
	options: IterateBuildScriptBindingsOptions = {}
): Generator<BuildScriptBinding> {
	if (!content.trim()) return

	const masked = maskJsComments(content)
	const skipImports = options.skipImports === true

	if (!skipImports) {
		yield* iterateImportBindings(content)
	}

	yield* iterateSimpleDeclarationBindings(masked)
	yield* iterateDestructuringBindings(masked)
	yield* iterateFunctionBindings(masked)
	if (options.includeNestedBindings === true) {
		yield* iterateNestedScriptBindings(content)
	}
}

/**
 * Adds binding names from one build script body (deduped set; order not significant).
 */
export function collectBindingsFromBuildScriptContent(content: string, into: Set<string>): void {
	for (const b of iterateBuildScriptBindings(content)) {
		into.add(b.name)
	}
}

/**
 * Renders ambient declarations so each name is a legal value reference in template expr TS.
 * When `bindingTypes` has an entry, uses that type string; otherwise `any`.
 */
export function formatBuildBindingAmbientBlock(
	names: ReadonlySet<string>,
	bindingTypes?: ReadonlyMap<string, string>,
	writableNames?: ReadonlySet<string>
): string {
	if (names.size === 0) return ''
	return (
		[...names]
			.filter(n => n.length > 0)
			.sort()
			.map(n => {
				const t = bindingTypes?.get(n)
				const typeStr = t !== undefined && t.trim().length > 0 ? t : 'any'
				const kind = writableNames?.has(n) ? 'let' : 'const'
				return `declare ${kind} ${n}: ${typeStr};`
			})
			.join('\n') + '\n'
	)
}

/**
 * Collect `interface` / `type` / `enum` slices from every build script body (document order).
 */
export function collectBuildScriptTypeDeclarationTexts(
	buildScriptBodies: Iterable<string>
): string[] {
	const out: string[] = []
	for (const body of buildScriptBodies) {
		out.push(...extractBuildScriptTypeDeclarationTexts(body))
	}
	return out
}

/**
 * Ambient prelude for template expression checking: optional type declarations from the build
 * script(s), then `declare const` per binding. When `buildScriptBodiesForInference` is set,
 * TypeScript checker types are used instead of `any` where resolution succeeds (same-file only).
 */
export function formatBuildScopeAmbientPrelude(
	names: ReadonlySet<string>,
	typeDeclarationSources: readonly string[],
	buildScriptBodiesForInference?: readonly string[],
	writableNames?: ReadonlySet<string>,
	precomputedBindingTypes?: ReadonlyMap<string, string>
): string {
	const typeBlock = typeDeclarationSources
		.map(s => s.trim())
		.filter(Boolean)
		.join('\n\n')
	const bindingTypes =
		precomputedBindingTypes ??
		(buildScriptBodiesForInference !== undefined && buildScriptBodiesForInference.length > 0
			? collectBindingTypeStringsFromBuildScripts(buildScriptBodiesForInference)
			: undefined)
	const bindingBlock = formatBuildBindingAmbientBlock(names, bindingTypes, writableNames)
	if (typeBlock && bindingBlock) return typeBlock + '\n\n' + bindingBlock
	if (typeBlock) return typeBlock.endsWith('\n') ? typeBlock : typeBlock + '\n'
	return bindingBlock
}

/**
 * Union of bindings from every build script body in the document.
 */
export function collectBuildScopeBindingNames(buildScriptContents: Iterable<string>): Set<string> {
	const names = new Set<string>()
	for (const scriptBody of buildScriptContents) {
		if (!scriptBody.trim()) continue
		collectBindingsFromBuildScriptContent(scriptBody, names)
	}
	return names
}
