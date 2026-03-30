import type {
	VirtualCode,
	IScriptSnapshot,
	CodeInformation,
	CodeMapping,
} from '@volar/language-core'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import {
	parseMinimalHtmlDocument,
	walkHtmlNodes,
	type HTMLDocument,
	type Node,
} from '@aero-js/html-parser'
import {
	collectBuildScopeBindingNames,
	formatBuildBindingAmbientBlock,
} from '@aero-js/compiler/build-scope-bindings'
import { collectForDirectiveBindingNames, isDirectiveAttr } from '@aero-js/compiler'
import { BUILD_SCRIPT_PREAMBLE, AMBIENT_DECLARATIONS } from './generated/ambient-preamble'

const FULL_FEATURES: CodeInformation = {
	completion: true,
	format: true,
	navigation: true,
	semantic: true,
	structure: true,
	verification: true,
}

const SUPPRESSED_IN_BUILD = new Set([
	6133, // '{0}' is declared but its value is never read.
	6196, // '{0}' is declared but never used.
	6198, // All destructured elements are unused.
	7006, // Parameter '{0}' implicitly has an 'any' type.
])

const BUILD_SCRIPT_FEATURES: CodeInformation = {
	completion: true,
	format: true,
	navigation: true,
	semantic: true,
	structure: true,
	verification: {
		shouldReport: (_source, code) => !SUPPRESSED_IN_BUILD.has(Number(code)),
	},
}

const ambientSnapshot: IScriptSnapshot = {
	getText: (start, end) => AMBIENT_DECLARATIONS.substring(start, end),
	getLength: () => AMBIENT_DECLARATIONS.length,
	getChangeRange: () => undefined,
}

function getScriptType(
	node: Node,
	sourceText: string
): 'build' | 'client' | 'inline' | 'blocking' | 'external' | 'importmap' | null {
	if (node.tag !== 'script') return null
	const attrs = node.attributes
	if (!attrs) return 'client'

	if ('src' in attrs) return 'external'
	if ('is:build' in attrs) return 'build'
	if ('is:inline' in attrs) return 'inline'
	if ('props' in attrs || 'data-props' in attrs) return 'inline'
	if ('is:blocking' in attrs) return 'blocking'
	if (hasTypeImportmap(node, sourceText)) return 'importmap'
	return 'client'
}

/** True if script has lang="ts" or lang="typescript". */
function hasLangTs(node: Node, sourceText: string): boolean {
	if (node.startTagEnd == null) return false
	const tagStart = sourceText.lastIndexOf('<script', node.startTagEnd)
	if (tagStart === -1) return false
	const openTag = sourceText.substring(tagStart, node.startTagEnd)
	return /\blang\s*=\s*["'](ts|typescript)["']/i.test(openTag)
}

/**
 * True if script opts into JavaScript with lang="js" or lang="javascript".
 * For `<script is:build>`, this opts out of the default TypeScript tooling (compiler still accepts JS via oxc).
 */
function hasLangJs(node: Node, sourceText: string): boolean {
	if (node.startTagEnd == null) return false
	const tagStart = sourceText.lastIndexOf('<script', node.startTagEnd)
	if (tagStart === -1) return false
	const openTag = sourceText.substring(tagStart, node.startTagEnd)
	return /\blang\s*=\s*["'](js|javascript)["']/i.test(openTag)
}

/** True if script has type="importmap" (JSON, not JS/TS). */
function hasTypeImportmap(node: Node, sourceText: string): boolean {
	if (node.startTagEnd == null) return false
	const tagStart = sourceText.lastIndexOf('<script', node.startTagEnd)
	if (tagStart === -1) return false
	const openTag = sourceText.substring(tagStart, node.startTagEnd)
	return /\btype\s*=\s*["']importmap["']/i.test(openTag)
}

function createSnapshot(text: string): IScriptSnapshot {
	return {
		getText: (start, end) => text.substring(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	}
}

/** Mask inner text of script/style so `{` in JS/CSS does not become fake template interpolations. */
function maskScriptAndStyleInner(sourceText: string): string {
	return sourceText.replace(
		/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi,
		(match, _tag: string, inner: string) => match.replace(inner, ' '.repeat(inner.length))
	)
}

/** Mask the brace-wrapped value of for/data-for attributes so `{ const x of y }` is not a false interpolation. */
function maskForDirectiveValues(sourceText: string): string {
	return sourceText.replace(
		/\b(?:data-)?for\s*=\s*(['"])([\s\S]*?)\1/gi,
		(match, _q: string, inner: string) => match.replace(inner, ' '.repeat(inner.length))
	)
}

/** Attributes whose values are Aero directives (not interpolated). */
const FOR_ATTR_NAMES = new Set(['for', 'data-for'])

type AttributeInterpolation = {
	/** The expression text (without braces). */
	expression: string
	/** Absolute source offset of the expression start (after the `{`). */
	sourceOffset: number
}

type AttributeMask = {
	/** Absolute start offset of the region to mask. */
	start: number
	/** Length of the region to mask. */
	length: number
}

/**
 * Walks the HTML tree and tokenizes `{ }` interpolations inside non-directive
 * attribute values. Returns the interpolation segments and regions to mask.
 *
 * @remarks Uses the same regex approach as the VS Code extension
 * (`packages/vscode/src/analyzer/references.ts`). Attribute values are
 * tokenized individually with `attributeMode: true` so that `"` delimiters
 * do not interfere with brace detection.
 */
function collectAttributeInterpolations(
	roots: Node[],
	sourceText: string
): { interpolations: AttributeInterpolation[]; masks: AttributeMask[] } {
	const interpolations: AttributeInterpolation[] = []
	const masks: AttributeMask[] = []

	const attrRegex = /(?:\s|^)([a-zA-Z0-9\-:@.]+)(?:(\s*=\s*)(['"])([\s\S]*?)\3)?/gi

	for (const node of walkHtmlNodes(roots)) {
		if (!node.tag || node.startTagEnd == null) continue
		const tag = node.tag.toLowerCase()
		if (tag === 'script' || tag === 'style') continue

		const open = sourceText.substring(node.start, node.startTagEnd)
		const nameMatch = open.match(/^<\s*\/?\s*([a-zA-Z][\w-]*)/)
		if (!nameMatch) continue

		const attrsStart = node.start + nameMatch[0].length
		const gt = open.lastIndexOf('>')
		const attrsContent = gt > nameMatch[0].length ? open.slice(nameMatch[0].length, gt) : ''

		attrRegex.lastIndex = 0
		let attrMatch: RegExpExecArray | null

		while ((attrMatch = attrRegex.exec(attrsContent)) !== null) {
			const fullMatch = attrMatch[0]
			const name = attrMatch[1]
			const hasValue = !!attrMatch[3]
			const value = attrMatch[4] || ''

			if (!hasValue || !value) continue

			// Skip directive attributes (Alpine: x-*, @*, :*, .*)
			if (isDirectiveAttr(name)) continue

			// Skip for/data-for (already masked separately)
			if (FOR_ATTR_NAMES.has(name)) continue

			const matchStartInAttrs = attrMatch.index
			const nameStartInMatch = fullMatch.indexOf(name)
			const quote = attrMatch[3]
			const quoteIndex = fullMatch.indexOf(quote, nameStartInMatch + name.length)
			const absValueStart = attrsStart + matchStartInAttrs + quoteIndex + 1

			// Mask this attribute value region
			masks.push({ start: absValueStart, length: value.length })

			// Tokenize the attribute value individually
			const segments = tokenizeCurlyInterpolation(value, { attributeMode: true })
			for (const seg of segments) {
				if (seg.kind !== 'interpolation') continue
				const expr = seg.expression
				if (!expr.trim()) continue
				interpolations.push({
					expression: expr,
					sourceOffset: absValueStart + seg.start + 1,
				})
			}
		}
	}

	return { interpolations, masks }
}

/** Replace specified regions in text with spaces. */
function applyMasks(text: string, masks: AttributeMask[]): string {
	let result = text
	for (const mask of masks) {
		result =
			result.substring(0, mask.start) +
			' '.repeat(mask.length) +
			result.substring(mask.start + mask.length)
	}
	return result
}

/** Implicit loop variables injected by the for-directive runtime (see emit.ts). */
const FOR_LOOP_IMPLICIT_NAMES = ['index', 'first', 'last', 'length']

type ForDirectiveScope = {
	/** Offset where bindings become available (after the opening tag). */
	startOffset: number
	/** Offset where bindings go out of scope (end of the element). */
	endOffset: number
	/** All binding names in scope (user bindings + implicit loop variables). */
	bindingNames: string[]
}

/**
 * Walks the parsed HTML tree and collects for-directive scopes.
 *
 * @remarks The vscode-html-languageservice parser includes surrounding quotes in attribute values
 * (e.g. `"{ const doc of docs }"`), so we strip them before parsing.
 */
function collectForDirectiveScopes(roots: Node[], sourceText: string): ForDirectiveScope[] {
	const scopes: ForDirectiveScope[] = []

	for (const node of walkHtmlNodes(roots)) {
		const attrs = node.attributes
		if (!attrs) continue

		const rawValue = attrs['for'] ?? attrs['data-for'] ?? undefined
		if (rawValue == null) continue

		// Strip surrounding quotes if present (parser includes them)
		let value = rawValue
		if (
			value.length >= 2 &&
			((value[0] === '"' && value[value.length - 1] === '"') ||
				(value[0] === "'" && value[value.length - 1] === "'"))
		) {
			value = value.slice(1, -1)
		}

		// Strip outer braces: `{ const x of y }` → `const x of y`
		const braceMatch = /^\s*\{([\s\S]*)\}\s*$/.exec(value)
		const inner = braceMatch ? braceMatch[1].trim() : value.trim()
		if (!inner) continue

		let bindingNames: string[]
		try {
			bindingNames = [
				...collectForDirectiveBindingNames(inner),
				...FOR_LOOP_IMPLICIT_NAMES,
			]
		} catch {
			continue
		}

		if (bindingNames.length === 0) continue

		const startOffset = node.startTagEnd ?? node.start
		const endOffset = node.endTagStart ?? node.end
		scopes.push({ startOffset, endOffset, bindingNames })
	}

	return scopes
}

/** Returns the union of for-directive binding names whose scope range contains `offset`. */
function getForBindingsAtOffset(offset: number, scopes: ForDirectiveScope[]): Set<string> {
	const names = new Set<string>()
	for (const scope of scopes) {
		if (offset >= scope.startOffset && offset < scope.endOffset) {
			for (const name of scope.bindingNames) {
				names.add(name)
			}
		}
	}
	return names
}

export class AeroVirtualCode implements VirtualCode {
	id = 'root'
	languageId = 'html'
	mappings: CodeMapping[]
	embeddedCodes: VirtualCode[] = []
	htmlDocument: HTMLDocument

	constructor(public snapshot: IScriptSnapshot) {
		this.mappings = [
			{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [snapshot.getLength()],
				data: {
					completion: true,
					format: true,
					navigation: true,
					semantic: true,
					structure: true,
					verification: true,
				},
			},
		]

		const sourceText = snapshot.getText(0, snapshot.getLength())
		const doc = TextDocument.create('', 'html', 0, sourceText)
		this.htmlDocument = parseMinimalHtmlDocument(doc)

		const buildScriptBodies: string[] = []
		for (const node of walkHtmlNodes(this.htmlDocument.roots)) {
			if (getScriptType(node, sourceText) !== 'build') continue
			if (node.startTagEnd == null || node.endTagStart == null) continue
			const body = sourceText.substring(node.startTagEnd, node.endTagStart)
			if (body.trim()) buildScriptBodies.push(body)
		}
		const buildBindingNames = collectBuildScopeBindingNames(buildScriptBodies)

		this.embeddedCodes = [
			...this.extractEmbeddedCodes(snapshot, sourceText),
			...this.extractInterpolationVirtualCodes(sourceText, buildBindingNames),
			{
				id: 'ambient',
				languageId: 'typescriptdeclaration',
				snapshot: ambientSnapshot,
				mappings: [],
				embeddedCodes: [],
			},
		]
	}

	private extractInterpolationVirtualCodes(
		sourceText: string,
		buildBindingNames: ReadonlySet<string>
	): VirtualCode[] {
		const forScopes = collectForDirectiveScopes(this.htmlDocument.roots, sourceText)
		const out: VirtualCode[] = []
		let exprIdx = 0

		// Helper to create a virtual code for an interpolation expression.
		// Wraps in `[` + expr + `]` so spread expressions like `...Aero.props`
		// are valid TypeScript (spreads are only legal in array/object/call contexts).
		const makeExprVirtualCode = (
			expression: string,
			sourceOffset: number
		): VirtualCode => {
			const forBindings = getForBindingsAtOffset(sourceOffset, forScopes)
			const allBindings = forBindings.size > 0
				? new Set([...buildBindingNames, ...forBindings])
				: buildBindingNames

			const binderDecl = formatBuildBindingAmbientBlock(allBindings)
			const exprOffsetInVirtual = BUILD_SCRIPT_PREAMBLE.length + binderDecl.length + 1 // +1 for `[`
			const virtualText = BUILD_SCRIPT_PREAMBLE + binderDecl + '[' + expression + ']'

			return {
				id: `expr_${exprIdx++}`,
				languageId: 'typescript',
				snapshot: createSnapshot(virtualText),
				mappings: [
					{
						sourceOffsets: [sourceOffset],
						generatedOffsets: [exprOffsetInVirtual],
						lengths: [expression.length],
						data: BUILD_SCRIPT_FEATURES,
					},
				],
				embeddedCodes: [],
			}
		}

		// Pass 1: Attribute interpolations
		const { interpolations, masks } = collectAttributeInterpolations(
			this.htmlDocument.roots,
			sourceText
		)
		for (const interp of interpolations) {
			out.push(makeExprVirtualCode(interp.expression, interp.sourceOffset))
		}

		// Pass 2: Text-content interpolations (on masked text)
		const masked = applyMasks(
			maskForDirectiveValues(maskScriptAndStyleInner(sourceText)),
			masks
		)
		for (const seg of tokenizeCurlyInterpolation(masked)) {
			if (seg.kind !== 'interpolation') continue
			const expr = seg.expression
			if (!expr.trim()) continue
			out.push(makeExprVirtualCode(expr, seg.start + 1))
		}

		return out
	}

	private *extractEmbeddedCodes(
		snapshot: IScriptSnapshot,
		sourceText: string
	): Generator<VirtualCode> {
		let buildIdx = 0
		let clientIdx = 0
		let blockingIdx = 0
		let inlineIdx = 0
		let styleIdx = 0

		for (const node of walkHtmlNodes(this.htmlDocument.roots)) {
			if (node.tag === 'style' && node.startTagEnd != null && node.endTagStart != null) {
				const styleText = sourceText.substring(node.startTagEnd, node.endTagStart)
				yield {
					id: `style_${styleIdx++}`,
					languageId: 'css',
					snapshot: createSnapshot(styleText),
					mappings: [
						{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [0],
							lengths: [styleText.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
				continue
			}

			const scriptType = getScriptType(node, sourceText)
			if (!scriptType || scriptType === 'external' || scriptType === 'importmap') continue
			if (node.startTagEnd == null || node.endTagStart == null) continue

			const scriptContent = sourceText.substring(node.startTagEnd, node.endTagStart)
			if (!scriptContent.trim()) continue

			const isTs = hasLangTs(node, sourceText)

			if (scriptType === 'build') {
				// Build scripts default to TS + preamble; `lang="js"` / `javascript` opts into JS only.
				const useTypeScript = !hasLangJs(node, sourceText)
				if (useTypeScript) {
					const virtualText = BUILD_SCRIPT_PREAMBLE + scriptContent
					yield {
						id: `build_${buildIdx++}`,
						languageId: 'typescript',
						snapshot: createSnapshot(virtualText),
						mappings: [
							{
								sourceOffsets: [node.startTagEnd],
								generatedOffsets: [BUILD_SCRIPT_PREAMBLE.length],
								lengths: [scriptContent.length],
								data: BUILD_SCRIPT_FEATURES,
							},
						],
						embeddedCodes: [],
					}
				} else {
					yield {
						id: `build_${buildIdx++}`,
						languageId: 'javascript',
						snapshot: createSnapshot(scriptContent),
						mappings: [
							{
								sourceOffsets: [node.startTagEnd],
								generatedOffsets: [0],
								lengths: [scriptContent.length],
								data: BUILD_SCRIPT_FEATURES,
							},
						],
						embeddedCodes: [],
					}
				}
			} else if (scriptType === 'inline') {
				yield {
					id: `inline_${inlineIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: createSnapshot(scriptContent),
					mappings: [
						{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [0],
							lengths: [scriptContent.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
			} else if (scriptType === 'client') {
				yield {
					id: `client_${clientIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: createSnapshot(scriptContent),
					mappings: [
						{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [0],
							lengths: [scriptContent.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
			} else if (scriptType === 'blocking') {
				yield {
					id: `blocking_${blockingIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: createSnapshot(scriptContent),
					mappings: [
						{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [0],
							lengths: [scriptContent.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
			}
		}
	}
}
