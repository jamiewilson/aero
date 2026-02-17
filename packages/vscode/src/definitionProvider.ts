import * as vscode from 'vscode'
import { classifyPosition } from './positionAt'
import { getResolver } from './pathResolver'
import { isAeroDocument } from './scope'
import { CONTENT_GLOBALS, IMPORT_REGEX } from './constants'

/**
 * Provides Go to Definition for Aero template references in HTML files.
 *
 * Returns LocationLink[] (not Location) so that `originSelectionRange` controls
 * the underlined region in the source document -- e.g. the entire path string
 * acts as one clickable link rather than splitting on `/` and `.`.
 *
 * Supports:
 * - Import paths:        `import meta from '@components/meta'` -> client/components/meta.html
 * - Imported names:      `import meta from '...'` (name "meta") -> same file
 * - Script/link assets:  `src="@scripts/index.ts"` -> resolved asset
 * - Component tags:      `<nav-component>` -> client/components/nav.html
 * - Layout tags:         `<base-layout>` -> client/layouts/base.html
 * - Content globals:     `{ site.home.title }` -> client/content/site.ts (at property)
 */
export class AeroDefinitionProvider implements vscode.DefinitionProvider {
	provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.LocationLink[]> {
		if (!isAeroDocument(document)) return null

		const classification = classifyPosition(document, position)
		if (!classification) return null

		const resolver = getResolver(document)
		if (!resolver) return null

		switch (classification.kind) {
			case 'import-path': {
				const resolved = resolver.resolve(classification.specifier, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'import-name': {
				const resolved = resolver.resolve(classification.specifier, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'script-src':
			case 'link-href': {
				const value =
					classification.kind === 'script-src' ? classification.value : classification.value
				const resolved = resolver.resolve(value, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'component-tag': {
				const imports = collectImportedSpecifiers(document.getText())
				const importName = kebabToCamelCase(classification.baseName)
				const importedSpecifier = imports.get(importName)
				const alias =
					importedSpecifier ||
					(classification.suffix === 'component' ?
						`@components/${classification.baseName}`
					:	`@layouts/${classification.baseName}`)
				const resolved = resolver.resolve(alias, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'content-global': {
				const resolved = resolver.resolve(classification.alias, document.uri.fsPath)
				if (!resolved) return null
				const targetLine =
					classification.propertyPath ?
						findPropertyLine(resolved, classification.propertyPath)
					:	0
				return [makeLink(classification.range, resolved, targetLine)]
			}

			case 'expression-identifier': {
				return resolveExpressionIdentifierDefinition(
					document,
					position,
					classification.identifier,
					classification.range,
					resolver,
				)
			}
		}
	}
}

type ContentRef = { alias: string; propertyPath: string[] }

type BuildVarDef = {
	name: string
	range: vscode.Range
	contentRef?: ContentRef
}

type EachScope = {
	itemName: string
	itemRange: vscode.Range
	sourceExpr: string
	sourceRoot: string
	sourceRange: vscode.Range
	startOffset: number
	endOffset: number
}

function collectImportedSpecifiers(text: string): Map<string, string> {
	const imports = new Map<string, string>()
	IMPORT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = IMPORT_REGEX.exec(text)) !== null) {
		const defaultImport = match[1]?.trim()
		const namedImports = match[2]
		const namespaceImport = match[3]?.trim()
		const specifier = match[5]

		if (defaultImport) imports.set(defaultImport, specifier)
		if (namespaceImport) imports.set(namespaceImport, specifier)

		if (!namedImports) continue
		for (const rawName of namedImports.split(',')) {
			const name = rawName.trim()
			if (!name) continue
			const aliasParts = name.split(/\s+as\s+/i).map(part => part.trim())
			const localName = aliasParts[1] || aliasParts[0]
			if (localName) imports.set(localName, specifier)
		}
	}

	return imports
}

function kebabToCamelCase(value: string): string {
	return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

function resolveExpressionIdentifierDefinition(
	document: vscode.TextDocument,
	position: vscode.Position,
	identifier: string,
	originRange: vscode.Range,
	resolver: ReturnType<typeof getResolver>,
): vscode.LocationLink[] | null {
	const text = document.getText()
	const offset = document.offsetAt(position)
	const lineText = document.lineAt(position.line).text
	const chainAtCursor = getDotChainAt(lineText, position.character)

	const buildVars = collectBuildVariables(document, text)
	const scopes = collectEachScopes(document, text)

	const currentScope = findInnermostScope(scopes, offset)
	if (currentScope) {
		if (identifier === currentScope.itemName) {
			return [makeDocumentLink(originRange, document.uri, currentScope.itemRange)]
		}

		if (identifier === currentScope.sourceRoot) {
			const sourceDef = buildVars.get(currentScope.sourceRoot)
			if (sourceDef) {
				return [makeDocumentLink(originRange, document.uri, sourceDef.range)]
			}
			return [makeDocumentLink(originRange, document.uri, currentScope.sourceRange)]
		}

		const chain = getDotChainAt(document.lineAt(position.line).text, position.character)
		if (chain && chain.segments.length >= 2 && chain.segments[0] === currentScope.itemName) {
			const contentRef = resolveContentRefFromExpression(currentScope.sourceExpr, buildVars)
			if (contentRef) {
				const resolved = resolver?.resolve(contentRef.alias, document.uri.fsPath)
				if (resolved) {
					const propertyPath = [...contentRef.propertyPath, ...chain.segments.slice(1)]
					const line = findPropertyLine(resolved, propertyPath)
					return [makeLink(originRange, resolved, line)]
				}
			}
		}
	}

	const varDef = buildVars.get(identifier)
	if (varDef) {
		return [makeDocumentLink(originRange, document.uri, varDef.range)]
	}

	const chainResult = resolveGenericChainDefinition(
		document,
		position,
		originRange,
		resolver,
		buildVars,
		chainAtCursor,
	)
	if (chainResult) return chainResult

	return null
}

function resolveGenericChainDefinition(
	document: vscode.TextDocument,
	position: vscode.Position,
	originRange: vscode.Range,
	resolver: ReturnType<typeof getResolver>,
	buildVars: Map<string, BuildVarDef>,
	chainAtCursor: { segments: string[]; start: number; end: number } | null,
): vscode.LocationLink[] | null {
	if (!chainAtCursor || chainAtCursor.segments.length < 2) return null

	const cursorSegmentIndex = getCursorSegmentIndex(
		chainAtCursor.segments,
		chainAtCursor.start,
		position.character,
	)
	if (cursorSegmentIndex <= 0) return null

	const root = chainAtCursor.segments[0]
	const uptoCursor = chainAtCursor.segments.slice(1, cursorSegmentIndex + 1)

	if (root in CONTENT_GLOBALS) {
		const resolved = resolver?.resolve(CONTENT_GLOBALS[root], document.uri.fsPath)
		if (!resolved) return null
		const line = findPropertyLine(resolved, uptoCursor)
		return [makeLink(originRange, resolved, line)]
	}

	const rootDef = buildVars.get(root)
	if (!rootDef?.contentRef) return null

	const resolved = resolver?.resolve(rootDef.contentRef.alias, document.uri.fsPath)
	if (!resolved) return null

	const propertyPath = [...rootDef.contentRef.propertyPath, ...uptoCursor]
	const line = findPropertyLine(resolved, propertyPath)
	return [makeLink(originRange, resolved, line)]
}

function collectBuildVariables(
	document: vscode.TextDocument,
	text: string,
): Map<string, BuildVarDef> {
	const vars = new Map<string, BuildVarDef>()
	const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

	let scriptMatch: RegExpExecArray | null
	while ((scriptMatch = scriptRegex.exec(text)) !== null) {
		const attrs = (scriptMatch[1] || '').toLowerCase()
		if (/\bsrc\s*=/.test(attrs)) continue

		const content = scriptMatch[2]
		const contentStart = scriptMatch.index + scriptMatch[0].indexOf(content)

		const declRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g
		let declMatch: RegExpExecArray | null
		while ((declMatch = declRegex.exec(content)) !== null) {
			const name = declMatch[1]
			const initializer = (declMatch[2] || '').trim()
			const nameInDecl = declMatch[0].indexOf(name)
			const start = contentStart + declMatch.index + nameInDecl
			const end = start + name.length

			const def: BuildVarDef = {
				name,
				range: new vscode.Range(document.positionAt(start), document.positionAt(end)),
			}

			const ref = resolveContentRefFromExpression(initializer, vars)
			if (ref) {
				def.contentRef = ref
			}

			vars.set(name, def)
		}
	}

	return vars
}

function collectEachScopes(document: vscode.TextDocument, text: string): EachScope[] {
	type StackItem = {
		tagName: string
		startOffset: number
		each?: Omit<EachScope, 'endOffset'>
	}

	const scopes: EachScope[] = []
	const stack: StackItem[] = []
	const tagRegex = /<\/?([a-z][a-z0-9-]*)\b([^>]*?)>/gi

	let match: RegExpExecArray | null
	while ((match = tagRegex.exec(text)) !== null) {
		const fullTag = match[0]
		const isClosing = fullTag.startsWith('</')
		const tagName = match[1]
		const attrs = match[2] || ''
		const tagStart = match.index
		const tagEnd = tagStart + fullTag.length

		if (isClosing) {
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i].tagName === tagName) {
					const open = stack.splice(i, 1)[0]
					if (open.each) {
						scopes.push({ ...open.each, endOffset: tagEnd })
					}
					break
				}
			}
			continue
		}

		const each = parseEachAttribute(document, attrs, tagStart, fullTag)
		const selfClosing = /\/\s*>$/.test(fullTag)
		if (selfClosing) {
			if (each) {
				scopes.push({ ...each, startOffset: tagStart, endOffset: tagEnd })
			}
			continue
		}

		stack.push({
			tagName,
			startOffset: tagStart,
			each: each ? { ...each, startOffset: tagStart } : undefined,
		})
	}

	for (const open of stack) {
		if (open.each) {
			scopes.push({ ...open.each, endOffset: text.length })
		}
	}

	return scopes
}

function parseEachAttribute(
	document: vscode.TextDocument,
	attrs: string,
	tagStart: number,
	fullTag: string,
): Omit<EachScope, 'startOffset' | 'endOffset'> | null {
	const eachAttr = /\b(?:data-)?each\s*=\s*(['"])(.*?)\1/i.exec(attrs)
	if (!eachAttr) return null

	const expr = (eachAttr[2] || '').trim()
	const exprMatch =
		/^([A-Za-z_$][\w$]*)\s+in\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/.exec(expr)
	if (!exprMatch) return null

	const itemName = exprMatch[1]
	const sourceExpr = exprMatch[2]
	const sourceRoot = sourceExpr.split('.')[0]

	const attrsOffsetInTag = fullTag.indexOf(attrs)
	const attrBase = tagStart + (attrsOffsetInTag >= 0 ? attrsOffsetInTag : 0)
	const exprOffsetInAttr = eachAttr[0].indexOf(eachAttr[2])
	const exprStart = attrBase + eachAttr.index + exprOffsetInAttr

	const itemStart = exprStart + expr.indexOf(itemName)
	const itemEnd = itemStart + itemName.length
	const sourceStart = exprStart + expr.lastIndexOf(sourceExpr)
	const sourceEnd = sourceStart + sourceExpr.length

	return {
		itemName,
		itemRange: new vscode.Range(document.positionAt(itemStart), document.positionAt(itemEnd)),
		sourceExpr,
		sourceRoot,
		sourceRange: new vscode.Range(
			document.positionAt(sourceStart),
			document.positionAt(sourceEnd),
		),
	}
}

function findInnermostScope(scopes: EachScope[], offset: number): EachScope | null {
	let best: EachScope | null = null
	for (const scope of scopes) {
		if (offset < scope.startOffset || offset > scope.endOffset) continue
		if (!best) {
			best = scope
			continue
		}
		const bestSize = best.endOffset - best.startOffset
		const thisSize = scope.endOffset - scope.startOffset
		if (thisSize <= bestSize) {
			best = scope
		}
	}
	return best
}

function resolveContentRefFromExpression(
	expression: string,
	buildVars: Map<string, BuildVarDef>,
): ContentRef | null {
	const chainMatch =
		/^([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*))?$/.exec(
			expression.trim(),
		)
	if (!chainMatch) return null

	const root = chainMatch[1]
	const rest = chainMatch[2] ? chainMatch[2].split('.') : []

	if (root in CONTENT_GLOBALS) {
		return { alias: CONTENT_GLOBALS[root], propertyPath: rest }
	}

	const varDef = buildVars.get(root)
	if (varDef?.contentRef) {
		return {
			alias: varDef.contentRef.alias,
			propertyPath: [...varDef.contentRef.propertyPath, ...rest],
		}
	}

	return null
}

function makeDocumentLink(
	originRange: vscode.Range,
	targetUri: vscode.Uri,
	targetSelectionRange: vscode.Range,
): vscode.LocationLink {
	return {
		originSelectionRange: originRange,
		targetUri,
		targetRange: targetSelectionRange,
		targetSelectionRange,
	}
}

function getDotChainAt(
	lineText: string,
	offset: number,
): { segments: string[]; start: number; end: number } | null {
	const ch = lineText[offset]
	const prevCh = offset > 0 ? lineText[offset - 1] : ''
	if (!isIdentChar(ch) && ch !== '.' && !isIdentChar(prevCh)) return null

	let start = offset
	while (start > 0 && (isIdentChar(lineText[start - 1]) || lineText[start - 1] === '.')) {
		start--
	}

	let end = offset
	while (end < lineText.length && (isIdentChar(lineText[end]) || lineText[end] === '.')) {
		end++
	}

	const raw = lineText.slice(start, end).replace(/^\.+|\.+$/g, '')
	if (!raw) return null
	const segments = raw.split('.').filter(Boolean)
	if (!segments.length) return null

	const normalizedStart = start + lineText.slice(start, end).indexOf(raw)
	return { segments, start: normalizedStart, end: normalizedStart + raw.length }
}

function isIdentChar(ch: string | undefined): boolean {
	if (!ch) return false
	return /[a-zA-Z0-9_$]/.test(ch)
}

function getCursorSegmentIndex(
	segments: string[],
	chainStart: number,
	cursorOffset: number,
): number {
	let running = chainStart
	for (let i = 0; i < segments.length; i++) {
		const segStart = running
		const segEnd = segStart + segments[i].length
		if (cursorOffset <= segEnd) return i
		running = segEnd + 1
	}
	return segments.length - 1
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a LocationLink with originSelectionRange so VS Code underlines
 * exactly the range we specify (instead of splitting on word boundaries).
 */
function makeLink(
	originRange: vscode.Range,
	targetPath: string,
	targetLine: number = 0,
): vscode.LocationLink {
	const targetPos = new vscode.Position(targetLine, 0)
	return {
		originSelectionRange: originRange,
		targetUri: vscode.Uri.file(targetPath),
		targetRange: new vscode.Range(targetPos, targetPos),
		targetSelectionRange: new vscode.Range(targetPos, targetPos),
	}
}

/**
 * Find the line number of a nested property path in a TS/JS file.
 * For `site.home.title`, propertyPath is `['home', 'title']`.
 * Walks the file looking for each property key in sequence.
 */
function findPropertyLine(filePath: string, propertyPath: string[]): number {
	try {
		const fs = require('node:fs') as typeof import('node:fs')
		if (!fs.existsSync(filePath)) return 0
		const content = fs.readFileSync(filePath, 'utf-8')
		const lines = content.split('\n')

		let currentLine = 0
		let minDepth = 0
		for (const prop of propertyPath) {
			const found = findPropertyAtDepth(lines, prop, currentLine, minDepth)
			if (!found) break

			currentLine = found.line
			minDepth = found.depth + 1
		}

		return currentLine
	} catch {
		return 0
	}
}

function findPropertyAtDepth(
	lines: string[],
	property: string,
	startLine: number,
	minDepth: number,
): { line: number; depth: number } | null {
	const keyPattern = new RegExp(
		`(?:^|\\s|,)(?:${escapeRegex(property)}|'${escapeRegex(property)}'|"${escapeRegex(property)}")\\s*:`,
	)

	for (let i = startLine; i < lines.length; i++) {
		const depth = getBraceDepthBeforeLine(lines, i)
		if (depth < minDepth) continue
		if (keyPattern.test(lines[i])) {
			return { line: i, depth }
		}
	}

	return null
}

function getBraceDepthBeforeLine(lines: string[], lineIndex: number): number {
	let depth = 0
	for (let i = 0; i < lineIndex; i++) {
		for (const ch of lines[i]) {
			if (ch === '{') depth++
			if (ch === '}') depth = Math.max(0, depth - 1)
		}
	}
	return depth
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
