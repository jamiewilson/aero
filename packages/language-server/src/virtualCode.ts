import type {
	VirtualCode,
	IScriptSnapshot,
	CodeInformation,
	CodeMapping,
} from '@volar/language-core'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
	parseMinimalHtmlDocument,
	walkHtmlNodes,
	type HTMLDocument,
	type Node,
} from '@aero-js/html-parser'
import { formatBuildScopeAmbientPrelude } from '@aero-js/compiler/build-scope-bindings'
import {
	buildTemplateEditorAmbient,
	collectForDirectiveBindingNames,
	collectTemplateInterpolationSites,
} from '@aero-js/compiler'
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

		const {
			buildScriptBodies,
			typeDeclarationTexts: buildTypeDeclTexts,
			bindingNames: buildBindingNames,
		} = buildTemplateEditorAmbient(sourceText)

		this.embeddedCodes = [
			...this.extractEmbeddedCodes(snapshot, sourceText),
			...this.extractInterpolationVirtualCodes(
				sourceText,
				buildBindingNames,
				buildTypeDeclTexts,
				buildScriptBodies
			),
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
		buildBindingNames: ReadonlySet<string>,
		buildTypeDeclTexts: readonly string[],
		buildScriptBodies: readonly string[]
	): VirtualCode[] {
		const forScopes = collectForDirectiveScopes(this.htmlDocument.roots, sourceText)
		const out: VirtualCode[] = []
		let exprIdx = 0

		// Helper to create a virtual code for an interpolation expression.
		// Default: `[` + expr + `]` so bare spreads like `{...arr}` in text become valid array spread.
		// For `props` / `data-props` attributes, use `[{` + expr + `}]` so `{ ...obj }` inner text
		// is object spread (not `[...obj]` array spread, which requires Symbol.iterator on objects).
		const makeExprVirtualCode = (
			expression: string,
			sourceOffset: number,
			wrapPropsObjectLiteral?: boolean
		): VirtualCode => {
			const forBindings = getForBindingsAtOffset(sourceOffset, forScopes)
			const allBindings = forBindings.size > 0
				? new Set([...buildBindingNames, ...forBindings])
				: buildBindingNames

			const binderDecl = formatBuildScopeAmbientPrelude(allBindings, buildTypeDeclTexts, buildScriptBodies)
			const open = wrapPropsObjectLiteral ? '[{' : '['
			const close = wrapPropsObjectLiteral ? '}]' : ']'
			const exprOffsetInVirtual = BUILD_SCRIPT_PREAMBLE.length + binderDecl.length + open.length
			const virtualText = BUILD_SCRIPT_PREAMBLE + binderDecl + open + expression + close

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

		for (const site of collectTemplateInterpolationSites(sourceText)) {
			out.push(
				makeExprVirtualCode(site.expression, site.braceOffset, site.wrapPropsObjectLiteral === true)
			)
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
