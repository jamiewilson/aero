import type {
	VirtualCode,
	IScriptSnapshot,
	CodeInformation,
	CodeMapping,
} from '@volar/language-core'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
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
	parse,
} from '@aero-js/compiler'
import { analyzeBuildScriptForEditor } from '@aero-js/compiler/build-script-analysis'
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
function collectForDirectiveScopes(roots: Node[], _sourceText: string): ForDirectiveScope[] {
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
			bindingNames = [...collectForDirectiveBindingNames(inner), ...FOR_LOOP_IMPLICIT_NAMES]
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

type SlotScope = {
	startOffset: number
	endOffset: number
	bindingNames: string[]
	typedBindingNames: string[]
	typeDeclarationTexts: string[]
	typedBindingDecls: string[]
}

type PathAlias = {
	find: string
	replacement: string
}

const aliasContextCache = new Map<string, PathAlias[]>()

function kebabToCamelCase(value: string): string {
	return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

function slotTypeNameForSlot(slotName: string): string {
	if (slotName.length === 0) return 'DefaultSlotProps'
	const normalized = slotName.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
	if (!normalized) return 'DefaultSlotProps'
	const pascal = normalized
		.split(/\s+/)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join('')
	return `${pascal}SlotProps`
}

function slotBindingNameForSlot(slotName: string): string | null {
	const normalized = slotName.trim().toLowerCase()
	if (normalized === 'default' || normalized.length === 0) return 'defaultSlot'
	const candidate = kebabToCamelCase(slotName)
	if (!/^[A-Za-z_$][\w$]*$/.test(candidate)) return null
	if (candidate === 'default') return 'defaultSlot'
	return candidate
}

function parseSlotPropsBindings(rawValue: string | undefined): string[] {
	if (!rawValue) return []
	const trimmed = rawValue.trim().replace(/^['"]|['"]$/g, '')
	if (!trimmed) return []
	const braceMatch = /^\{([\s\S]*)\}$/.exec(trimmed)
	const inner = (braceMatch ? braceMatch[1] : trimmed).trim()
	if (!inner) return []
	const out: string[] = []
	for (const part of inner.split(',')) {
		const candidate = part.trim()
		if (!candidate) continue
		const alias = candidate.split(':').pop()?.trim() ?? candidate
		if (/^[A-Za-z_$][\w$]*$/.test(alias)) out.push(alias)
	}
	return [...new Set(out)]
}

function findTsconfigPath(startDir: string): string | null {
	return ts.findConfigFile(startDir, ts.sys.fileExists) ?? null
}

function loadPathAliasesForImporter(importerFile: string): PathAlias[] {
	const importerDir = path.dirname(importerFile)
	const tsconfigPath = findTsconfigPath(importerDir)
	if (!tsconfigPath) return []
	if (aliasContextCache.has(tsconfigPath)) return aliasContextCache.get(tsconfigPath) ?? []

	const configDir = path.dirname(tsconfigPath)
	const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
	if (read.error || !read.config) {
		aliasContextCache.set(tsconfigPath, [])
		return []
	}
	const compilerOptions = (read.config.compilerOptions ?? {}) as {
		baseUrl?: string
		paths?: Record<string, string[]>
	}
	const baseUrl = compilerOptions.baseUrl
		? path.resolve(configDir, compilerOptions.baseUrl)
		: configDir
	const out: PathAlias[] = []
	const pathsMap = compilerOptions.paths ?? {}
	for (const [key, values] of Object.entries(pathsMap)) {
		const first = values[0]
		if (!first) continue
		const find = key.replace(/\/$/, '').replace(/\/\*$/, '')
		const target = first.replace(/\/$/, '').replace(/\/\*$/, '')
		out.push({ find, replacement: path.resolve(baseUrl, target) })
	}

	aliasContextCache.set(tsconfigPath, out)
	return out
}

function tryResolveToHtml(candidateBasePath: string): string | null {
	if (!candidateBasePath) return null
	if (fs.existsSync(candidateBasePath) && candidateBasePath.endsWith('.html'))
		return candidateBasePath
	if (fs.existsSync(candidateBasePath + '.html')) return candidateBasePath + '.html'
	const indexHtml = path.join(candidateBasePath, 'index.html')
	if (fs.existsSync(indexHtml)) return indexHtml
	return null
}

function resolveHtmlImportPath(specifier: string, importerFile: string): string | null {
	if (!specifier || !importerFile) return null
	if (specifier.startsWith('/')) {
		const abs = path.resolve(specifier)
		return tryResolveToHtml(abs)
	}
	if (specifier.startsWith('.')) {
		const candidate = path.resolve(path.dirname(importerFile), specifier)
		return tryResolveToHtml(candidate)
	}

	if (!specifier.startsWith('@')) return null
	const aliases = loadPathAliasesForImporter(importerFile)
	for (const alias of aliases) {
		if (specifier === alias.find || specifier.startsWith(alias.find + '/')) {
			const rest = specifier.slice(alias.find.length).replace(/^\//, '')
			const candidate = path.join(alias.replacement, rest)
			const resolved = tryResolveToHtml(candidate)
			if (resolved) return resolved
		}
	}

	return null
}

function collectImportedHtmlByIdentifier(
	htmlSource: string,
	htmlFilePath?: string
): Map<string, string> {
	const out = new Map<string, string>()
	if (!htmlFilePath) return out
	let script = ''
	try {
		const parsed = parse(htmlSource)
		script = parsed.buildScript?.content ?? ''
	} catch {
		return out
	}
	if (!script.trim()) return out
	try {
		const { imports } = analyzeBuildScriptForEditor(script)
		for (const imp of imports) {
			const resolvedHtml = resolveHtmlImportPath(imp.specifier, htmlFilePath)
			if (!resolvedHtml) continue
			if (imp.defaultBinding) out.set(imp.defaultBinding, resolvedHtml)
			for (const named of imp.namedBindings) {
				out.set(named.local, resolvedHtml)
			}
		}
	} catch {
		return out
	}
	return out
}

function collectSlotTypeInfoByName(
	componentHtmlPath: string
): Map<string, { typeName: string; declarationText: string; bindingNames: string[] }> {
	let source = ''
	try {
		source = fs.readFileSync(componentHtmlPath, 'utf-8')
	} catch {
		return new Map()
	}
	let parsed: ReturnType<typeof parse>
	try {
		parsed = parse(source)
	} catch {
		return new Map()
	}
	const buildScript = parsed.buildScript?.content ?? ''
	if (!buildScript.trim()) return new Map()
	const ambient = buildTemplateEditorAmbient(source)
	const byName = new Map<string, string>()
	for (const decl of ambient.typeDeclarationTexts) {
		const m = /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/.exec(decl)
		if (!m) continue
		byName.set(m[1], decl)
	}
	const doc = TextDocument.create(componentHtmlPath, 'html', 0, source)
	const htmlDoc = parseMinimalHtmlDocument(doc)
	const slotNamesWithBindings = new Map<string, string[]>()
	for (const node of walkHtmlNodes(htmlDoc.roots)) {
		if (node.tag !== 'slot') continue
		const attrs = node.attributes ?? {}
		const slotNameRaw = attrs.name ?? 'default'
		const slotName = String(slotNameRaw).replace(/^['"]|['"]$/g, '')
		const normalized = slotName || 'default'
		slotNamesWithBindings.set(
			normalized,
			parseSlotPropsBindings(attrs.props ?? attrs['data-props'] ?? undefined)
		)
	}
	const out = new Map<
		string,
		{ typeName: string; declarationText: string; bindingNames: string[] }
	>()
	for (const [slotName, bindingNames] of slotNamesWithBindings.entries()) {
		const typeName = slotTypeNameForSlot(slotName)
		const decl = byName.get(typeName)
		if (!decl) continue
		out.set(slotName, { typeName, declarationText: decl, bindingNames })
	}
	return out
}

function collectSlotScopes(sourceText: string, htmlFilePath: string | undefined): SlotScope[] {
	const scopes: SlotScope[] = []
	if (!htmlFilePath) return scopes
	const importedHtml = collectImportedHtmlByIdentifier(sourceText, htmlFilePath)
	if (importedHtml.size === 0) return scopes

	const doc = TextDocument.create(htmlFilePath, 'html', 0, sourceText)
	const htmlDoc = parseMinimalHtmlDocument(doc)

	for (const node of walkHtmlNodes(htmlDoc.roots)) {
		if (!node.tag || !node.tag.endsWith('-component')) continue
		const base = node.tag.replace(/-component$/, '')
		const importName = kebabToCamelCase(base)
		const componentPath = importedHtml.get(importName)
		if (!componentPath) continue

		const slotTypeInfoByName = collectSlotTypeInfoByName(componentPath)
		if (slotTypeInfoByName.size === 0) continue

		for (const child of node.children ?? []) {
			if (!child || child.startTagEnd == null || child.endTagStart == null) continue
			if (child.tag === 'script' || child.tag === 'style') continue
			const childAttrs = child.attributes ?? {}
			const slotAttr = childAttrs.slot ?? childAttrs['data-slot'] ?? 'default'
			const slotName = String(slotAttr).replace(/^['"]|['"]$/g, '') || 'default'
			const slotTypeInfo = slotTypeInfoByName.get(slotName)
			if (!slotTypeInfo) continue
			const slotBinding = slotBindingNameForSlot(slotName)
			const bindingNames = slotBinding ? [slotBinding, 'slotProps'] : ['slotProps']
			const typedBindingDecls: string[] = []
			const typedBindingNames: string[] = []
			for (const binding of slotTypeInfo.bindingNames) {
				typedBindingNames.push(binding)
				typedBindingDecls.push(
					`declare const ${binding}: ${slotTypeInfo.typeName}[${JSON.stringify(binding)}];`
				)
			}
			typedBindingNames.push('slotProps')
			typedBindingDecls.push(`declare const slotProps: ${slotTypeInfo.typeName};`)
			scopes.push({
				startOffset: child.startTagEnd,
				endOffset: child.endTagStart,
				bindingNames,
				typedBindingNames,
				typeDeclarationTexts: [slotTypeInfo.declarationText],
				typedBindingDecls,
			})
		}
	}

	return scopes
}

function getSlotBindingsAtOffset(offset: number, scopes: SlotScope[]): Set<string> {
	const names = new Set<string>()
	for (const scope of scopes) {
		if (offset >= scope.startOffset && offset < scope.endOffset) {
			for (const name of scope.bindingNames) names.add(name)
		}
	}
	return names
}

function getSlotTypeDeclsAtOffset(offset: number, scopes: SlotScope[]): Set<string> {
	const decls = new Set<string>()
	for (const scope of scopes) {
		if (offset >= scope.startOffset && offset < scope.endOffset) {
			for (const decl of scope.typeDeclarationTexts) decls.add(decl)
		}
	}
	return decls
}

function getSlotTypedBindingNamesAtOffset(offset: number, scopes: SlotScope[]): Set<string> {
	const names = new Set<string>()
	for (const scope of scopes) {
		if (offset >= scope.startOffset && offset < scope.endOffset) {
			for (const name of scope.typedBindingNames) names.add(name)
		}
	}
	return names
}

function getSlotTypedBindingDeclsAtOffset(offset: number, scopes: SlotScope[]): string[] {
	const out: string[] = []
	for (const scope of scopes) {
		if (offset >= scope.startOffset && offset < scope.endOffset) {
			out.push(...scope.typedBindingDecls)
		}
	}
	return [...new Set(out)]
}

export class AeroVirtualCode implements VirtualCode {
	id = 'root'
	languageId = 'html'
	mappings: CodeMapping[]
	embeddedCodes: VirtualCode[] = []
	htmlDocument: HTMLDocument
	htmlFilePath?: string

	constructor(
		public snapshot: IScriptSnapshot,
		htmlFilePath?: string
	) {
		this.htmlFilePath = htmlFilePath
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
		const doc = TextDocument.create(this.htmlFilePath ?? '', 'html', 0, sourceText)
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
		const slotScopes = collectSlotScopes(sourceText, this.htmlFilePath)
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
			const slotBindings = getSlotBindingsAtOffset(sourceOffset, slotScopes)
			const slotTypedBindingNames = getSlotTypedBindingNamesAtOffset(sourceOffset, slotScopes)
			const slotTypeDecls = getSlotTypeDeclsAtOffset(sourceOffset, slotScopes)
			const slotTypedBindingDecls = getSlotTypedBindingDeclsAtOffset(sourceOffset, slotScopes)
			const combinedBindings =
				forBindings.size > 0 || slotBindings.size > 0
					? new Set([...buildBindingNames, ...forBindings, ...slotBindings])
					: new Set(buildBindingNames)
			for (const typedName of slotTypedBindingNames) {
				combinedBindings.delete(typedName)
			}
			const mergedTypeDecls =
				slotTypeDecls.size > 0
					? [
							...buildTypeDeclTexts,
							...[...slotTypeDecls].filter(d => !buildTypeDeclTexts.includes(d)),
						]
					: buildTypeDeclTexts

			const binderDecl = formatBuildScopeAmbientPrelude(
				combinedBindings,
				mergedTypeDecls,
				buildScriptBodies
			)
			const slotTypedBlock =
				slotTypedBindingDecls.length > 0 ? slotTypedBindingDecls.join('\n') + '\n' : ''
			const open = wrapPropsObjectLiteral ? '[{' : '['
			const close = wrapPropsObjectLiteral ? '}]' : ']'
			const exprOffsetInVirtual =
				BUILD_SCRIPT_PREAMBLE.length + binderDecl.length + slotTypedBlock.length + open.length
			const virtualText =
				BUILD_SCRIPT_PREAMBLE + binderDecl + slotTypedBlock + open + expression + close

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
