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
import { collectBindingTypeStringsFromBuildScripts } from '@aero-js/compiler'
import { formatBuildScopeAmbientPrelude, iterateBuildScriptBindings, collectBuildScopeBindingNames } from '@aero-js/compiler/build-scope-bindings'
import {
	buildTemplateEditorAmbient,
	collectForDirectiveBindingNames,
	collectTemplateInterpolationSites,
	collectTemplateScriptBlocks,
	parse,
	parsePropsAttributeBindings,
	formatPropsInjectedAmbientDecls,
	EVENT_HANDLER_SCOPE_DECL,
	annotateStateScriptForEditorTypecheck,
	rewriteHypermediaActionStateRefs,
	type BuildBindingProperties,
} from '@aero-js/compiler'
import { buildDirectiveAttributeNames } from '@aero-js/compiler/build-directive-attributes'
import { ATTR_FOR } from '@aero-js/compiler/constants'
import { analyzeBuildScriptForEditor } from '@aero-js/compiler/build-script-analysis'
import { AMBIENT_DECLARATIONS, BUILD_SCRIPT_PREAMBLE } from '@aero-js/compiler/ambient-preamble'
import { collectTemplateReferences, type SourceDocument } from '@aero-js/core/template-diagnostics'

function isSnippetModuleDocument(filePath: string | undefined): boolean {
	if (!filePath) return false
	const normalized = filePath.replace(/\\/g, '/')
	return normalized.includes('/content/snippets/')
}

const FULL_FEATURES: CodeInformation = {
	completion: true,
	format: true,
	navigation: true,
	semantic: true,
	structure: true,
	verification: true,
}

/**
 * Each Volar extra service script is its own root file. Without a module marker, TypeScript treats
 * them as classic scripts sharing one global scope (`module: None`), so a build-script `const
 * props` collides with `declare const props` in expression virtuals (TS2451).
 */
const EMBEDDED_MODULE_CLOSURE = '\nexport {}\n'

/** Shared virtual modules (images, aero:content, *.md) — not per-file `*.html` wildcards. */
const SHARED_VIRTUAL_AMBIENT = AMBIENT_DECLARATIONS.replace(
	/declare module '\*\.html'[\s\S]*?\}\n\n?/,
	''
)

function asEmbeddedModuleSnapshot(source: string): IScriptSnapshot {
	return createSnapshot(source + EMBEDDED_MODULE_CLOSURE)
}

function createSourceDocumentAdapter(sourceText: string, filePath: string): SourceDocument {
	const doc = TextDocument.create(filePath, 'html', 0, sourceText)
	return {
		uri: { fsPath: filePath },
		getText: () => sourceText,
		positionAt: offset => doc.positionAt(offset),
		offsetAt: position => doc.offsetAt(position),
	}
}

function collectTemplateUsedNames(sourceText: string, filePath = ''): Set<string> {
	const used = new Set<string>()
	for (const ref of collectTemplateReferences(
		createSourceDocumentAdapter(sourceText, filePath),
		sourceText
	)) {
		used.add(ref.content)
	}
	return used
}

function formatSyntheticUses(names: Iterable<string>): string {
	return [...names].map(name => `\nvoid ${name}`).join('')
}

function buildScriptTemplateUseFooter(
	sourceText: string,
	scriptContent: string,
	filePath = ''
): string {
	const usedInTemplate = collectTemplateUsedNames(sourceText, filePath)
	const names = new Set<string>()
	for (const binding of iterateBuildScriptBindings(scriptContent)) {
		if (usedInTemplate.has(binding.name)) names.add(binding.name)
	}
	try {
		const { imports } = analyzeBuildScriptForEditor(scriptContent)
		for (const imp of imports) {
			if (imp.defaultBinding && usedInTemplate.has(imp.defaultBinding)) {
				names.add(imp.defaultBinding)
			}
			for (const named of imp.namedBindings) {
				if (usedInTemplate.has(named.local)) names.add(named.local)
			}
		}
	} catch {
		// Incomplete script syntax — TypeScript reports through the virtual file.
	}
	return formatSyntheticUses(names)
}

function stateScriptTemplateUseFooter(sourceText: string, scriptContent: string, filePath = ''): string {
	const usedInTemplate = collectTemplateUsedNames(sourceText, filePath)
	const names = new Set<string>()
	for (const binding of iterateBuildScriptBindings(scriptContent, {
		includeNestedBindings: true,
	})) {
		if (usedInTemplate.has(binding.name)) names.add(binding.name)
	}
	return formatSyntheticUses(names)
}


function tryResolveToTs(candidateBasePath: string): string | null {
	if (!candidateBasePath) return null
	if (fs.existsSync(candidateBasePath) && candidateBasePath.endsWith('.ts')) return candidateBasePath
	return null
}

function resolveAliasImportPath(
	specifier: string,
	importerFile: string,
	tryResolve: (candidate: string) => string | null
): string | null {
	if (!specifier || !importerFile) return null
	if (specifier.startsWith('/')) {
		return tryResolve(path.resolve(specifier))
	}
	if (specifier.startsWith('.')) {
		return tryResolve(path.resolve(path.dirname(importerFile), specifier))
	}
	if (!specifier.startsWith('@')) return null
	const aliases = loadPathAliasesForImporter(importerFile)
	for (const alias of aliases) {
		if (specifier === alias.find || specifier.startsWith(alias.find + '/')) {
			const rest = specifier.slice(alias.find.length).replace(/^\//, '')
			const candidate = path.join(alias.replacement, rest)
			const resolved = tryResolve(candidate)
			if (resolved) return resolved
		}
	}
	return null
}

function resolveTsImportPath(specifier: string, importerFile: string): string | null {
	return resolveAliasImportPath(specifier, importerFile, tryResolveToTs)
}

function tryResolveToExistingFile(candidateBasePath: string): string | null {
	try {
		return fs.existsSync(candidateBasePath) && fs.statSync(candidateBasePath).isFile()
			? candidateBasePath
			: null
	} catch {
		return null
	}
}

function hasExportModifier(node: ts.Node): boolean {
	return (
		ts.canHaveModifiers(node) &&
		!!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
	)
}

function collectTsModuleExportNames(absPath: string): {
	typeNames: string[]
	valueNames: string[]
	hasDefault: boolean
} {
	let source: string
	try {
		source = fs.readFileSync(absPath, 'utf-8')
	} catch {
		return { typeNames: [], valueNames: [], hasDefault: false }
	}
	const sf = ts.createSourceFile(absPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	const typeNames: string[] = []
	const valueNames: string[] = []
	let hasDefault = false

	for (const stmt of sf.statements) {
		if (ts.isExportAssignment(stmt)) {
			if (!stmt.isExportEquals) hasDefault = true
			continue
		}
		if (ts.isExportDeclaration(stmt)) {
			if (stmt.moduleSpecifier) continue
			if (!stmt.exportClause || ts.isNamespaceExport(stmt.exportClause)) continue
			for (const el of stmt.exportClause.elements) {
				const name = (el.name ?? el.propertyName)?.getText(sf)
				if (!name) continue
				if (stmt.isTypeOnly || el.isTypeOnly) typeNames.push(name)
				else valueNames.push(name)
			}
			continue
		}
		if (!hasExportModifier(stmt)) continue
		if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) {
			typeNames.push(stmt.name.text)
		} else if (ts.isVariableStatement(stmt)) {
			for (const decl of stmt.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) valueNames.push(decl.name.text)
			}
		} else if (
			ts.isFunctionDeclaration(stmt) ||
			ts.isClassDeclaration(stmt) ||
			ts.isEnumDeclaration(stmt)
		) {
			if (stmt.name) valueNames.push(stmt.name.text)
		}
	}

	return { typeNames, valueNames, hasDefault }
}

function toAmbientReExportSpecifier(relPath: string): string {
	const normalized = relPath.replace(/\\/g, '/')
	const withoutExt = normalized.replace(/\.tsx?$/, '')
	return withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`
}

function buildTsImportAmbientSupplement(
	htmlFilePath: string,
	buildScriptBodies: readonly string[]
): string {
	if (!htmlFilePath) return ''
	const ambientDir = path.dirname(`${htmlFilePath}.ambient.d.ts`)
	const specifierToPath = new Map<string, string>()
	for (const body of buildScriptBodies) {
		if (!body.trim()) continue
		try {
			const { imports } = analyzeBuildScriptForEditor(body)
			for (const imp of imports) {
				if (!imp.specifier.endsWith('.ts')) continue
				const resolved = resolveTsImportPath(imp.specifier, htmlFilePath)
				if (resolved) specifierToPath.set(imp.specifier, resolved)
			}
		} catch {
			continue
		}
	}
	if (specifierToPath.size === 0) return ''
	const blocks: string[] = []
	for (const [specifier, absPath] of specifierToPath) {
		const rel = path.relative(ambientDir, absPath).replace(/\\/g, '/')
		const relImport = toAmbientReExportSpecifier(rel.startsWith('.') ? rel : `./${rel}`)
		const { typeNames, valueNames, hasDefault } = collectTsModuleExportNames(absPath)
		const escapedSpecifier = specifier.replace(/'/g, "\\'")
		const lines = [`declare module '${escapedSpecifier}' {`]
		if (typeNames.length > 0) {
			lines.push(`  export type { ${typeNames.join(', ')} } from '${relImport}'`)
		}
		if (valueNames.length > 0) {
			lines.push(`  export { ${valueNames.join(', ')} } from '${relImport}'`)
		}
		if (hasDefault) {
			lines.push(`  export { default } from '${relImport}'`)
		}
		if (typeNames.length === 0 && valueNames.length === 0 && !hasDefault) {
			lines.push(`  export * from '${relImport}'`)
		}
		lines.push(`}`, '')
		blocks.push(...lines)
	}
	return blocks.join('\n')
}

function buildNonCodeImportAmbientSupplement(
	htmlFilePath: string,
	scriptBodies: readonly string[]
): string {
	if (!htmlFilePath) return ''
	const specifiers = new Set<string>()
	for (const body of scriptBodies) {
		try {
			for (const imp of analyzeBuildScriptForEditor(body).imports) {
				if (/\.(?:[cm]?[jt]sx?|json)$/i.test(imp.specifier)) continue
				if (resolveAliasImportPath(imp.specifier, htmlFilePath, tryResolveToExistingFile)) {
					specifiers.add(imp.specifier)
				}
			}
		} catch {
			// Let TypeScript report incomplete script syntax through its virtual file.
		}
	}
	return [...specifiers]
		.map(specifier => `declare module '${specifier.replace(/'/g, "\\'")}' {\n  const value: any\n  export default value\n}`)
		.join('\n\n')
}

function getScriptType(
	node: Node,
	sourceText: string
): 'build' | 'state' | 'client' | 'inline' | 'blocking' | 'external' | 'importmap' | null {
	if (node.tag !== 'script') return null
	const attrs = node.attributes
	if (!attrs) return 'client'

	if ('src' in attrs) return 'external'
	if ('is:build' in attrs) return 'build'
	if ('is:state' in attrs) return 'state'
	if ('is:inline' in attrs) return 'inline'
	if (hasPropsAttribute(attrs)) return 'inline'
	if ('is:blocking' in attrs) return 'blocking'
	if (hasTypeImportmap(node, sourceText)) return 'importmap'
	return 'client'
}

const PROPS_ATTR_KEYS = ['props', 'aero-props', 'data-aero-props'] as const

function getPropsAttributeValue(attrs: Record<string, string | null | undefined>): string | undefined {
	for (const key of PROPS_ATTR_KEYS) {
		if (key in attrs) return attrs[key] ?? undefined
	}
	return undefined
}

function hasPropsAttribute(attrs: Record<string, string | null | undefined>): boolean {
	return PROPS_ATTR_KEYS.some(key => key in attrs)
}
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

		let rawValue: string | undefined
		for (const name of buildDirectiveAttributeNames(ATTR_FOR)) {
			if (attrs[name] != null) {
				rawValue = attrs[name]
				break
			}
		}
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

		// Bindings apply to sibling attributes on the same tag (e.g. href="{ path }" with
		// for="{ const { path } of links }"), not only to content after the opening tag.
		const startOffset = node.start
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

function collectBuildBindingProperties(buildScriptBodies: readonly string[]): BuildBindingProperties {
	const out = new Map<string, ReadonlySet<string>>()
	for (const body of buildScriptBodies) {
		for (const binding of iterateBuildScriptBindings(body)) {
			if (binding.properties && binding.properties.size > 0) {
				out.set(binding.name, binding.properties)
			}
		}
	}
	return out
}

function scriptAttrsFromSource(node: Node, sourceText: string): string {
	if (node.startTagEnd == null) return ''
	const tagStart = sourceText.lastIndexOf('<script', node.startTagEnd)
	if (tagStart === -1) return ''
	return sourceText.substring(tagStart + '<script'.length, node.startTagEnd)
}

function propsInjectedPreamble(
	node: Node,
	sourceText: string,
	buildBindingProperties: BuildBindingProperties
): string {
	const attrs = scriptAttrsFromSource(node, sourceText)
	const { injectedNames } = parsePropsAttributeBindings(attrs, buildBindingProperties)
	return formatPropsInjectedAmbientDecls(injectedNames)
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

function loadGeneratedSnippetsAmbient(htmlFilePath: string): string {
	if (!htmlFilePath) return ''
	const tsconfigPath = findTsconfigPath(path.dirname(htmlFilePath))
	if (!tsconfigPath) return ''
	const projectRoot = path.dirname(tsconfigPath)
	const snippetsDts = path.join(projectRoot, '.aero', 'cache', 'types', 'snippets.d.ts')
	if (!fs.existsSync(snippetsDts)) return ''
	return fs.readFileSync(snippetsDts, 'utf-8')
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
	if (fs.existsSync(candidateBasePath) && candidateBasePath.endsWith('.html')) return candidateBasePath
	return null
}

function resolveHtmlImportPath(specifier: string, importerFile: string): string | null {
	return resolveAliasImportPath(specifier, importerFile, tryResolveToHtml)
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
			parseSlotPropsBindings(getPropsAttributeValue(attrs))
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
	private readonly buildBindingProperties: BuildBindingProperties
	private readonly buildScriptBodies: readonly string[]
	private readonly buildTypeDeclTexts: readonly string[]
	private readonly buildOnlyBindingNames: ReadonlySet<string>

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
			stateScriptBodies,
			typeDeclarationTexts: buildTypeDeclTexts,
			bindingNames: buildBindingNames,
			writableStateBindingNames,
			ownedStateBindingNames,
			readonlyReactivePropNames,
		} = buildTemplateEditorAmbient(sourceText)
		this.buildBindingProperties = collectBuildBindingProperties(buildScriptBodies)
		this.buildScriptBodies = buildScriptBodies
		this.buildTypeDeclTexts = buildTypeDeclTexts
		this.buildOnlyBindingNames = collectBuildScopeBindingNames(buildScriptBodies)

		const inferenceBodies = [...buildScriptBodies, ...stateScriptBodies]
		const cachedBindingTypes =
			inferenceBodies.some(body => body.trim().length > 0)
				? collectBindingTypeStringsFromBuildScripts(inferenceBodies)
				: undefined

		const allScriptBodies = collectTemplateScriptBlocks(sourceText)
			.filter(block => block.kind !== 'external')
			.map(block => block.content)
		const tsImportAmbient = buildTsImportAmbientSupplement(this.htmlFilePath ?? '', allScriptBodies)
		const nonCodeImportAmbient = buildNonCodeImportAmbientSupplement(
			this.htmlFilePath ?? '',
			allScriptBodies
		)
		const snippetsAmbient = loadGeneratedSnippetsAmbient(this.htmlFilePath ?? '')
		const fullAmbient =
			BUILD_SCRIPT_PREAMBLE +
			`\n${SHARED_VIRTUAL_AMBIENT}` +
			(tsImportAmbient.length > 0 ? `\n${tsImportAmbient}` : '') +
			(nonCodeImportAmbient.length > 0 ? `\n${nonCodeImportAmbient}` : '') +
			(snippetsAmbient.length > 0 ? `\n${snippetsAmbient}` : '')

		if (isSnippetModuleDocument(this.htmlFilePath)) {
			this.embeddedCodes = [
				{
					id: 'ambient',
					languageId: 'typescriptdeclaration',
					snapshot: createSnapshot(fullAmbient),
					mappings: [],
					embeddedCodes: [],
				},
			]
			return
		}

		this.embeddedCodes = [
			...this.extractEmbeddedCodes(snapshot, sourceText),
			...this.extractInterpolationVirtualCodes(
				sourceText,
				buildBindingNames,
				buildTypeDeclTexts,
				writableStateBindingNames,
				ownedStateBindingNames,
				readonlyReactivePropNames,
				cachedBindingTypes
			),
			{
				id: 'ambient',
				languageId: 'typescriptdeclaration',
				snapshot: createSnapshot(fullAmbient),
				mappings: [],
				embeddedCodes: [],
			},
		]
	}

	private extractInterpolationVirtualCodes(
		sourceText: string,
		buildBindingNames: ReadonlySet<string>,
		buildTypeDeclTexts: readonly string[],
		writableStateBindingNames: ReadonlySet<string>,
		ownedStateBindingNames: ReadonlySet<string>,
		readonlyReactivePropNames: ReadonlySet<string>,
		cachedBindingTypes?: ReadonlyMap<string, string>
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
			options?: {
				wrapPropsObjectLiteral?: boolean
				isEventHandler?: boolean
				isForDirectiveHead?: boolean
			}
		): VirtualCode => {
			const forBindings = getForBindingsAtOffset(sourceOffset, forScopes)
			const slotBindings = getSlotBindingsAtOffset(sourceOffset, slotScopes)
			const slotTypedBindingNames = getSlotTypedBindingNamesAtOffset(sourceOffset, slotScopes)
			const slotTypeDecls = getSlotTypeDeclsAtOffset(sourceOffset, slotScopes)
			const slotTypedBindingDecls = getSlotTypedBindingDeclsAtOffset(sourceOffset, slotScopes)
			const combinedBindings =
				options?.isForDirectiveHead === true
					? new Set(buildBindingNames)
					: forBindings.size > 0 || slotBindings.size > 0
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
				undefined,
				options?.isEventHandler
					? new Set(
							[...writableStateBindingNames, ...readonlyReactivePropNames].filter(name =>
								combinedBindings.has(name)
							)
						)
					: undefined,
				cachedBindingTypes
			)
			const slotTypedBlock =
				slotTypedBindingDecls.length > 0 ? slotTypedBindingDecls.join('\n') + '\n' : ''
			const head = BUILD_SCRIPT_PREAMBLE + binderDecl + slotTypedBlock

			if (options?.isEventHandler) {
				const handlerExpr = rewriteHypermediaActionStateRefs(expression, ownedStateBindingNames)
				const virtualText =
					head +
					EVENT_HANDLER_SCOPE_DECL +
					handlerExpr +
					(handlerExpr.trimEnd().endsWith(';') ? '' : ';')
				const exprOffsetInVirtual = head.length + EVENT_HANDLER_SCOPE_DECL.length
				return {
					id: `expr_${exprIdx++}`,
					languageId: 'typescript',
					snapshot: asEmbeddedModuleSnapshot(virtualText),
					mappings: [
						{
							sourceOffsets: [sourceOffset],
							generatedOffsets: [exprOffsetInVirtual],
							lengths: [expression.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
			}

			if (options?.isForDirectiveHead === true) {
				const forBindings = getForBindingsAtOffset(sourceOffset, forScopes)
				const voidUses = [...forBindings].map(name => `void ${name};`).join(' ')
				const stmt = voidUses
					? `for (${expression}) { ${voidUses} }`
					: `for (${expression}) {}`
				const exprOffsetInVirtual = head.length + 'for ('.length
				const virtualText = head + stmt
				return {
					id: `expr_${exprIdx++}`,
					languageId: 'typescript',
					snapshot: asEmbeddedModuleSnapshot(virtualText),
					mappings: [
						{
							sourceOffsets: [sourceOffset],
							generatedOffsets: [exprOffsetInVirtual],
							lengths: [expression.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
			}

			const open = options?.wrapPropsObjectLiteral ? '[{' : '['
			const close = options?.wrapPropsObjectLiteral ? '}]' : ']'
			const exprOffsetInVirtual = head.length + open.length
			const virtualText = head + open + expression + close

			return {
				id: `expr_${exprIdx++}`,
				languageId: 'typescript',
				snapshot: asEmbeddedModuleSnapshot(virtualText),
				mappings: [
					{
						sourceOffsets: [sourceOffset],
						generatedOffsets: [exprOffsetInVirtual],
						lengths: [expression.length],
						data: FULL_FEATURES,
					},
				],
				embeddedCodes: [],
			}
		}

		for (const site of collectTemplateInterpolationSites(sourceText)) {
			out.push(
				makeExprVirtualCode(site.expression, site.expressionOffset ?? site.braceOffset, {
					wrapPropsObjectLiteral: site.wrapPropsObjectLiteral === true,
					isEventHandler: site.isEventHandler === true,
					isForDirectiveHead: site.isForDirectiveHead === true,
				})
			)
		}

		return out
	}

	private *extractEmbeddedCodes(
		snapshot: IScriptSnapshot,
		sourceText: string
	): Generator<VirtualCode> {
		let buildIdx = 0
		let stateIdx = 0
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

			if (scriptType === 'build' || scriptType === 'state') {
				// Build/state scripts default to TS + preamble; `lang="js"` / `javascript` opts into JS only.
				const useTypeScript = !hasLangJs(node, sourceText)
				const idPrefix = scriptType === 'build' ? 'build' : 'state'
				const idx = scriptType === 'build' ? buildIdx++ : stateIdx++
				if (useTypeScript) {
					const scriptForVirtual =
						scriptType === 'state'
							? annotateStateScriptForEditorTypecheck(scriptContent)
							: { text: scriptContent, segments: [{ sourceStart: 0, sourceLength: scriptContent.length, generatedStart: 0 }] }
					const buildPrelude =
						scriptType === 'state' && this.buildOnlyBindingNames.size > 0
							? formatBuildScopeAmbientPrelude(
									this.buildOnlyBindingNames,
									this.buildTypeDeclTexts,
									undefined,
									undefined,
									this.buildScriptBodies.some(body => body.trim().length > 0)
										? collectBindingTypeStringsFromBuildScripts(this.buildScriptBodies)
										: undefined
								)
							: ''
					const templateUseFooter =
						scriptType === 'build'
							? buildScriptTemplateUseFooter(
									sourceText,
									scriptContent,
									this.htmlFilePath ?? ''
								)
							: stateScriptTemplateUseFooter(
									sourceText,
									scriptContent,
									this.htmlFilePath ?? ''
								)
					const virtualText =
						BUILD_SCRIPT_PREAMBLE + buildPrelude + scriptForVirtual.text + templateUseFooter
					const generatedPreludeLength = BUILD_SCRIPT_PREAMBLE.length + buildPrelude.length
					yield {
						id: `${idPrefix}_${idx}`,
						languageId: 'typescript',
						snapshot: asEmbeddedModuleSnapshot(virtualText),
						mappings: scriptForVirtual.segments.map(segment => ({
							sourceOffsets: [node.startTagEnd! + segment.sourceStart],
							generatedOffsets: [generatedPreludeLength + segment.generatedStart],
							lengths: [segment.sourceLength],
							data: FULL_FEATURES,
						})),
						embeddedCodes: [],
					}
				} else {
					yield {
						id: `${idPrefix}_${idx}`,
						languageId: 'javascript',
						snapshot: asEmbeddedModuleSnapshot(scriptContent),
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
			} else if (scriptType === 'inline') {
				const preamble = propsInjectedPreamble(node, sourceText, this.buildBindingProperties)
				const virtualText = preamble + scriptContent
				yield {
					id: `inline_${inlineIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: asEmbeddedModuleSnapshot(virtualText),
					mappings: [
						{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [preamble.length],
							lengths: [scriptContent.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
			} else if (scriptType === 'client') {
				const attrs = node.attributes ?? {}
				const hasProps = hasPropsAttribute(attrs)
				const preamble = hasProps
					? propsInjectedPreamble(node, sourceText, this.buildBindingProperties)
					: ''
				const virtualText = preamble + scriptContent
				yield {
					id: `client_${clientIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: asEmbeddedModuleSnapshot(virtualText),
					mappings: [
						{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [preamble.length],
							lengths: [scriptContent.length],
							data: FULL_FEATURES,
						},
					],
					embeddedCodes: [],
				}
			} else if (scriptType === 'blocking') {
				const attrs = node.attributes ?? {}
				const hasProps = hasPropsAttribute(attrs)
				const preamble = hasProps
					? propsInjectedPreamble(node, sourceText, this.buildBindingProperties)
					: ''
				const virtualText = preamble + scriptContent
				yield {
					id: `blocking_${blockingIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: asEmbeddedModuleSnapshot(virtualText),
					mappings: [
						{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [preamble.length],
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
