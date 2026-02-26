/**
 * Aero diagnostics: validate script directives, control flow, component imports, and template references.
 *
 * @remarks
 * Runs on Aero HTML files; reports missing/duplicate script types, invalid directive expressions, unresolved components, and undefined template variables. Uses analyzer (scopes, defined variables, template refs) and getResolver.
 */
import * as vscode from 'vscode'
import * as fs from 'node:fs'
import { getResolver } from './pathResolver'
import { COMPONENT_SUFFIX_REGEX, CONTENT_GLOBALS } from './constants'
import { isAeroDocument } from './scope'
import {
	collectDefinedVariables,
	collectVariablesByScope,
	collectTemplateScopes,
	collectTemplateReferences,
	TemplateScope,
	maskJsComments,
} from './analyzer'
import { kebabToCamelCase, collectImportedSpecifiers, findInnermostScope } from './utils'

const DIAGNOSTIC_SOURCE = 'aero'

/** Matches `<script ...>...</script>` tags with attributes and content. */
const SCRIPT_TAG_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

/** Matches is:build, is:inline, or is:blocking in attributes */
const IS_ATTR_REGEX = /\bis:(build|inline|blocking)\b/

/** Matches src= in script attributes (external scripts are exempt) */
const SRC_ATTR_REGEX = /\bsrc\s*=/

/** Matches control flow attributes */
const IF_ATTR_REGEX = /\b(?:data-)?if(?:\s*=)/
const ELSE_IF_ATTR_REGEX = /\b(?:data-)?else-if(?:\s*=)/
const ELSE_ATTR_REGEX = /\b(?:data-)?else\b/

/** Matches opening tags and captures the attributes part */
const OPEN_TAG_REGEX = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b([^>]*?)\/?>/gi

/** Matches opening and closing tags and captures attributes for opening tags */
const ANY_TAG_REGEX = /<\/?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b([^>]*?)\/?>/gi

/** HTML void elements that do not create a new nesting level */
const VOID_ELEMENTS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
])

/** Matches directive attributes with explicit values */
const DIRECTIVE_ATTR_VALUE_REGEX =
	/\b(data-if|if|data-else-if|else-if|data-each|each|data-props|props)\s*=\s*(['"])(.*?)\2/gi

/** Matches HTML comment blocks */
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g

/** Matches opening tags with component/layout suffix */
const COMPONENT_TAG_OPEN_REGEX =
	/<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\/?>/gi

export class AeroDiagnostics implements vscode.Disposable {
	private collection: vscode.DiagnosticCollection
	private disposables: vscode.Disposable[] = []

	constructor(context: vscode.ExtensionContext) {
		this.collection = vscode.languages.createDiagnosticCollection('aero')

		// Run diagnostics on open and save
		this.disposables.push(
			vscode.workspace.onDidOpenTextDocument(doc => this.updateDiagnostics(doc)),
			vscode.workspace.onDidSaveTextDocument(doc => this.updateDiagnostics(doc)),
			vscode.workspace.onDidChangeTextDocument(e => this.updateDiagnostics(e.document)),
			vscode.workspace.onDidCloseTextDocument(doc => this.collection.delete(doc.uri)),
		)

		// Run on all currently open documents
		for (const doc of vscode.workspace.textDocuments) {
			this.updateDiagnostics(doc)
		}
	}

	dispose(): void {
		this.collection.dispose()
		for (const d of this.disposables) d.dispose()
	}

	private updateDiagnostics(document: vscode.TextDocument): void {
		if (!isAeroDocument(document)) {
			this.collection.delete(document.uri)
			return
		}

		const diagnostics: vscode.Diagnostic[] = []
		const text = document.getText()

		this.checkScriptTags(document, text, diagnostics)
		this.checkConditionalChains(document, text, diagnostics)
		this.checkDirectiveExpressionBraces(document, text, diagnostics)
		this.checkComponentReferences(document, text, diagnostics)
		this.checkUndefinedVariables(document, text, diagnostics)
		this.checkUnusedVariables(document, text, diagnostics)
		this.checkDuplicateDeclarations(document, text, diagnostics)

		this.collection.set(document.uri, diagnostics)
	}

	// -----------------------------------------------------------------------
	// 3. Directive attributes must use brace-wrapped expressions
	// -----------------------------------------------------------------------

	private checkDirectiveExpressionBraces(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		const ignoredRanges = getIgnoredRanges(text)

		OPEN_TAG_REGEX.lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = OPEN_TAG_REGEX.exec(text)) !== null) {
			const tagStart = match.index
			if (isInRanges(tagStart, ignoredRanges)) continue

			const attrs = match[2] || ''
			if (!attrs) continue

			DIRECTIVE_ATTR_VALUE_REGEX.lastIndex = 0
			let attrMatch: RegExpExecArray | null
			while ((attrMatch = DIRECTIVE_ATTR_VALUE_REGEX.exec(attrs)) !== null) {
				const attrName = attrMatch[1]
				const attrValue = (attrMatch[3] || '').trim()
				const needsBraces = this.requiresBracedDirectiveValue(attrName)

				if (!needsBraces) continue
				if (attrValue.startsWith('{') && attrValue.endsWith('}')) continue

				const attrsStart = tagStart + match[0].indexOf(attrs)
				const start = attrsStart + attrMatch.index
				const end = start + attrMatch[0].length
				const example = `${attrName}="{ expression }"`
				const diagnostic = new vscode.Diagnostic(
					new vscode.Range(document.positionAt(start), document.positionAt(end)),
					`Directive \`${attrName}\` must use a braced expression, e.g. ${example}`,
					vscode.DiagnosticSeverity.Error,
				)
				diagnostic.source = DIAGNOSTIC_SOURCE
				diagnostics.push(diagnostic)
			}
		}
	}

	private requiresBracedDirectiveValue(attrName: string): boolean {
		return [
			'if',
			'data-if',
			'else-if',
			'data-else-if',
			'each',
			'data-each',
			'props',
			'data-props',
		].includes(attrName)
	}

	// -----------------------------------------------------------------------
	// 1. Script tags validation
	// -----------------------------------------------------------------------

	private isInHead(text: string, position: number): boolean {
		const beforeText = text.slice(0, position)
		const headOpenMatch = beforeText.match(/<head(?:\s|>)/)
		const headCloseMatch = beforeText.match(/<\/head\s*>/)
		const headOpen = headOpenMatch ? headOpenMatch.index! : -1
		const headClose = headCloseMatch ? headCloseMatch.index! : -1
		return headOpen > headClose
	}

	private checkScriptTags(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		const ignoredRanges = getIgnoredRanges(text)

		SCRIPT_TAG_REGEX.lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = SCRIPT_TAG_REGEX.exec(text)) !== null) {
			const tagStart = match.index
			if (isInRanges(tagStart, ignoredRanges)) continue

			const attrs = match[1]
			const content = match[2]

			// Skip external scripts (have src attribute) - they stay in place
			if (SRC_ATTR_REGEX.test(attrs)) continue

			// Skip scripts in <head> that might be third-party
			// Use regex to match <head> or <head > tag, not substrings like <header> or <base-layout>
			const beforeText = text.slice(0, tagStart)
			const headOpenMatch = beforeText.match(/<head(?:\s|>)/)
			const headCloseMatch = beforeText.match(/<\/head\s*>/)
			const headOpen = headOpenMatch ? headOpenMatch.index! : -1
			const headClose = headCloseMatch ? headCloseMatch.index! : -1
			if (headOpen > headClose) {
				continue
			}

			// Check for imports in is:inline scripts (in body) without type="module"
			const hasImport = /\bimport\b/.test(content)
			const hasModuleType = /\btype\s*=\s*["']?module["']?\b/.test(attrs)

			if (hasImport && !hasModuleType) {
				// Check if it's is:inline (and not in head) — only is:inline needs type="module" for imports
				// Plain <script> are bundled as module by default; no warning for them.
				if (/\bis:inline\b/.test(attrs) && !this.isInHead(text, tagStart)) {
					const contentStart = tagStart + match[0].indexOf(content)
					const importMatch = /\bimport\b/.exec(content)
					if (importMatch) {
						const importStart = contentStart + importMatch.index
						const importEnd = importStart + 6
						const diagnostic = new vscode.Diagnostic(
							new vscode.Range(
								document.positionAt(importStart),
								document.positionAt(importEnd),
							),
							"Imports in <script is:inline> require type=\"module\" attribute.",
							vscode.DiagnosticSeverity.Error,
						)
						diagnostic.source = DIAGNOSTIC_SOURCE
						diagnostics.push(diagnostic)
					}
				}
			}

			// Valid if has any is:* attribute (build, inline, blocking) or pass:data (handled by Vite). Plain <script> = client by default — no warning.
			if (IS_ATTR_REGEX.test(attrs) || /\bpass:data\b/.test(attrs)) {
				continue
			}

			// Plain <script> without attributes are valid (bundled as module by default)
		}
	}

	// -----------------------------------------------------------------------
	// 2. Orphaned else-if / else without preceding if
	// -----------------------------------------------------------------------

	private checkConditionalChains(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		const lastConditionalTypeByDepth = new Map<number, 'if' | 'else-if' | null>()
		let depth = 0
		const ignoredRanges = getIgnoredRanges(text)

		ANY_TAG_REGEX.lastIndex = 0
		let match: RegExpExecArray | null

		const getLastConditionalType = (currentDepth: number): 'if' | 'else-if' | null => {
			return lastConditionalTypeByDepth.get(currentDepth) ?? null
		}

		const setLastConditionalType = (
			currentDepth: number,
			type: 'if' | 'else-if' | null,
		): void => {
			lastConditionalTypeByDepth.set(currentDepth, type)
		}

		while ((match = ANY_TAG_REGEX.exec(text)) !== null) {
			const tagStart = match.index
			if (isInRanges(tagStart, ignoredRanges)) continue

			const fullTag = match[0]
			const tagName = (match[1] || '').toLowerCase()
			const isClosingTag = fullTag.startsWith('</')
			const isSelfClosingTag = /\/\s*>$/.test(fullTag) || VOID_ELEMENTS.has(tagName)

			if (isClosingTag) {
				depth = Math.max(0, depth - 1)
				continue
			}

			const currentDepth = depth
			const lastConditionalType = getLastConditionalType(currentDepth)

			const attrs = match[2] || ''
			if (!attrs) {
				setLastConditionalType(currentDepth, null)
				if (!isSelfClosingTag) depth += 1
				continue
			}

			if (IF_ATTR_REGEX.test(attrs) && !ELSE_IF_ATTR_REGEX.test(attrs)) {
				setLastConditionalType(currentDepth, 'if')
				if (!isSelfClosingTag) depth += 1
				continue
			}

			if (ELSE_IF_ATTR_REGEX.test(attrs)) {
				if (lastConditionalType !== 'if' && lastConditionalType !== 'else-if') {
					const attrMatch = attrs.match(/(?:data-)?else-if\b/)
					if (attrMatch && attrMatch.index !== undefined) {
						const attrBase = tagStart + match[0].indexOf(attrs)
						const start = attrBase + attrMatch.index
						const end = start + attrMatch[0].length
						const diagnostic = new vscode.Diagnostic(
							new vscode.Range(document.positionAt(start), document.positionAt(end)),
							'else-if must follow an element with if or else-if',
							vscode.DiagnosticSeverity.Error,
						)
						diagnostic.source = DIAGNOSTIC_SOURCE
						diagnostics.push(diagnostic)
					}
				}
				setLastConditionalType(currentDepth, 'else-if')
				if (!isSelfClosingTag) depth += 1
				continue
			}

			if (ELSE_ATTR_REGEX.test(attrs) && !ELSE_IF_ATTR_REGEX.test(attrs)) {
				if (lastConditionalType !== 'if' && lastConditionalType !== 'else-if') {
					const attrMatch = attrs.match(/(?:data-)?else\b/)
					if (attrMatch && attrMatch.index !== undefined) {
						const attrBase = tagStart + match[0].indexOf(attrs)
						const start = attrBase + attrMatch.index
						const end = start + attrMatch[0].length
						const diagnostic = new vscode.Diagnostic(
							new vscode.Range(document.positionAt(start), document.positionAt(end)),
							'else must follow an element with if or else-if',
							vscode.DiagnosticSeverity.Error,
						)
						diagnostic.source = DIAGNOSTIC_SOURCE
						diagnostics.push(diagnostic)
					}
				}
				setLastConditionalType(currentDepth, null)
				if (!isSelfClosingTag) depth += 1
				continue
			}

			setLastConditionalType(currentDepth, null)
			if (!isSelfClosingTag) depth += 1
		}
	}

	// -----------------------------------------------------------------------
	// 4. Missing component/layout files
	// -----------------------------------------------------------------------

	private checkComponentReferences(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		const resolver = getResolver(document)
		if (!resolver) return
		const imports = collectImportedSpecifiers(text)
		const ignoredRanges = getIgnoredRanges(text)

		COMPONENT_TAG_OPEN_REGEX.lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = COMPONENT_TAG_OPEN_REGEX.exec(text)) !== null) {
			const tagStart = match.index
			if (isInRanges(tagStart, ignoredRanges)) continue

			const tagName = match[1]
			const suffixMatch = COMPONENT_SUFFIX_REGEX.exec(tagName)
			if (!suffixMatch) continue

			const suffix = suffixMatch[1] as 'component' | 'layout'
			const baseName = tagName.replace(COMPONENT_SUFFIX_REGEX, '')
			const importName = kebabToCamelCase(baseName)
			const importedSpecifier = imports.get(importName)

			if (!importedSpecifier) {
				const startPos = document.positionAt(match.index)
				const endPos = document.positionAt(match.index + match[0].length)
				const diagnostic = new vscode.Diagnostic(
					new vscode.Range(startPos, endPos),
					`Component '${baseName}' is not imported. Explicit imports are required.`,
					vscode.DiagnosticSeverity.Error,
				)
				diagnostic.source = DIAGNOSTIC_SOURCE
				diagnostics.push(diagnostic)
				continue
			}

			const resolved = resolver.resolve(importedSpecifier, document.uri.fsPath)
			if (resolved && !fs.existsSync(resolved)) {
				const startPos = document.positionAt(match.index)
				const endPos = document.positionAt(match.index + match[0].length)
				const diagnostic = new vscode.Diagnostic(
					new vscode.Range(startPos, endPos),
					`${suffix === 'component' ? 'Component' : 'Layout'} file not found: ${baseName}.html`,
					vscode.DiagnosticSeverity.Warning,
				)
				diagnostic.source = DIAGNOSTIC_SOURCE
				diagnostics.push(diagnostic)
			}
		}
	}
	// -----------------------------------------------------------------------
	// 5. Undefined variables in template
	// -----------------------------------------------------------------------

	private checkUndefinedVariables(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		const [definedVars] = collectDefinedVariables(document, text)
		const templateScopes = collectTemplateScopes(document, text)
		const references = collectTemplateReferences(document, text)

		// Allowed globals that are always available
		const ALLOWED_GLOBALS = new Set([
			...Object.keys(CONTENT_GLOBALS),
			'Aero',
			'console',
			'Math',
			'JSON',
			'Object',
			'Array',
			'String',
			'Number',
			'Boolean',
			'Date',
			'RegExp',
			'Map',
			'Set',
			'WeakMap',
			'WeakSet',
			'Promise',
			'Error',
			'NaN',
			'Infinity',
			'undefined',
			'null',
			'true',
			false,
			'window',
			'document',
			'globalThis',
			// Alpine.js built-ins
			'$el',
			'$event',
			'$data',
			'$dispatch',
			'$refs',
			'$watch',
			'$root',
			'$nextTick',
			'$tick',
			'$store',
			'$persist',
			'$restore',
			'$abi',
			// HTMX built-ins
			'$target',
			'$trigger',
			'$triggerElement',
			'$response',
		])

		for (const ref of references) {
			// 1. Check if it's a global
			if (ALLOWED_GLOBALS.has(ref.content)) continue

			// 1.5. Skip undefined check for Alpine-defined variables
			// Variables in x-data, @click, etc. are defined in Alpine's runtime scope
			if (ref.isAlpine) continue

			// 2. Check if it's defined in <script>
			const def = definedVars.get(ref.content)
			if (def) {
				if (def.properties && ref.propertyPath && ref.propertyPath.length > 0) {
					const firstProp = ref.propertyPath[0]
					if (!def.properties.has(firstProp)) {
						const range =
							ref.propertyRanges && ref.propertyRanges.length > 0
								? ref.propertyRanges[0]
								: ref.range
						const diagnostic = new vscode.Diagnostic(
							range,
							`Property '${firstProp}' does not exist on type '${ref.content}'`,
							vscode.DiagnosticSeverity.Error,
						)
						diagnostic.source = DIAGNOSTIC_SOURCE
						diagnostics.push(diagnostic)
					}
				}
				continue
			}

			// 3. Check if it's in a template scope (data-each)
			// We need to find if the reference is within a scope that defines it
			const scope = findInnermostScope(templateScopes, ref.offset)
			if (scope && scope.itemName === ref.content) continue

			// Also check parent scopes!
			let parentScope = scope
			let foundInScope = false
			while (parentScope) {
				if (parentScope.itemName === ref.content) {
					foundInScope = true
					break
				}
				// find parent... naive approach: re-search in scopes considering endOffset
				// Optimization: TemplateScope could have parent ref, but list is flat
				// For now, simpler: iterating all scopes is okay for typical file size
				parentScope = findParentScope(templateScopes, parentScope)
			}
			if (foundInScope) continue

			const message = ref.isComponent
				? `Component '${ref.content}' is not defined`
				: `Variable '${ref.content}' is not defined`

			const diagnostic = new vscode.Diagnostic(
				ref.range,
				message,
				vscode.DiagnosticSeverity.Error,
			)
			diagnostic.source = DIAGNOSTIC_SOURCE
			diagnostics.push(diagnostic)
		}
	}

	// -----------------------------------------------------------------------
	// 6. Unused variables in script
	// -----------------------------------------------------------------------

	private checkUnusedVariables(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		const references = collectTemplateReferences(document, text)
		const usedInTemplate = new Set<string>()
		for (const ref of references) {
			usedInTemplate.add(ref.content)
		}

		// Check unused in is:build scope (template + build scripts)
		this.checkUnusedInScope(document, text, 'build', usedInTemplate, diagnostics)

		// Check unused in bundled scope (plain/client scripts)
		this.checkUnusedInScope(document, text, 'bundled', usedInTemplate, diagnostics)

		// Check unused in is:inline scope (inline scripts only)
		this.checkUnusedInScope(document, text, 'inline', usedInTemplate, diagnostics)

		// Check unused in is:blocking scope (blocking scripts only)
		this.checkUnusedInScope(document, text, 'blocking', usedInTemplate, diagnostics)
	}

	private checkUnusedInScope(
		document: vscode.TextDocument,
		text: string,
		scope: 'build' | 'bundled' | 'inline' | 'blocking',
		usedInTemplate: Set<string>,
		diagnostics: vscode.Diagnostic[],
	): void {
		const definedVars = collectVariablesByScope(document, text, scope)

		// Get script content for this scope only
		const scopeContent = this.getScriptContentByScope(text, scope)
		const maskedContent = maskJsComments(scopeContent).replace(
			/(['"])(?:(?=(\\?))\2.)*?\1/g,
			() => ' '.repeat(20),
		)

		for (const [name, def] of definedVars) {
			// For build scope: check if used in template or in build scripts
			if (scope === 'build') {
				if (usedInTemplate.has(name)) continue

				// Check usage in build scripts
				const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				const usageRegex = new RegExp(`\\b${escapedName}\\b`, 'g')
				const matches = maskedContent.match(usageRegex)
				if (matches && matches.length > 1) continue
			}
			// For bundled or blocking: check usage in client scripts (including pass:data references)
			else if (scope === 'bundled' || scope === 'blocking') {
				const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				const usageRegex = new RegExp(`\\b${escapedName}\\b`, 'g')
				const matches = maskedContent.match(usageRegex)
				// For pass:data references, require at least one usage in the script
				// For declarations/imports, require more than just the definition
				if (def.kind === 'reference') {
					if (matches && matches.length >= 1) continue
				} else {
					if (matches && matches.length > 1) continue
				}
			}
			// For inline: check usage only within inline scripts
			else {
				const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				const usageRegex = new RegExp(`\\b${escapedName}\\b`, 'g')
				const matches = maskedContent.match(usageRegex)
				if (matches && matches.length > 1) continue
			}

			const diagnostic = new vscode.Diagnostic(
				def.range,
				`'${name}' is declared but its value is never read.`,
				vscode.DiagnosticSeverity.Hint,
			)
			diagnostic.tags = [vscode.DiagnosticTag.Unnecessary]
			diagnostic.source = DIAGNOSTIC_SOURCE
			diagnostics.push(diagnostic)
		}
	}

	private getScriptContentByScope(text: string, scope: 'build' | 'bundled' | 'inline' | 'blocking'): string {
		const scopeAttr: Record<'build' | 'bundled' | 'inline' | 'blocking', RegExp> = {
			build: /\bis:build\b/,
			bundled: /(?!)/, // bundled = plain/client scripts; match via fallback below
			inline: /\bis:inline\b/,
			blocking: /\bis:blocking\b/,
		}

		let content = ''
		const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
		let scriptMatch: RegExpExecArray | null

		while ((scriptMatch = scriptRegex.exec(text)) !== null) {
			const rawAttrs = scriptMatch[1] || ''
			const attrs = rawAttrs.toLowerCase()
			if (/\bsrc\s*=/.test(attrs)) continue

			// Check if script matches the requested scope
			let isMatch = scopeAttr[scope].test(attrs)

			// For bundled scope: plain <script> (no is:build, is:inline, is:blocking)
			if (scope === 'bundled' && !isMatch) {
				if (!/\bis:build\b/.test(attrs) && !/\bis:inline\b/.test(attrs) && !/\bis:blocking\b/.test(attrs)) {
					isMatch = true
				}
			}

			if (!isMatch) continue

			content += ' ' + scriptMatch[2]
		}

		return content
	}

	private checkDuplicateDeclarations(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		const [, duplicates] = collectDefinedVariables(document, text)

		for (const dup of duplicates) {
			const diagnostic = new vscode.Diagnostic(
				dup.range,
				`'${dup.name}' is declared multiple times (as '${dup.kind1}' and '${dup.kind2}').`,
				vscode.DiagnosticSeverity.Error,
			)
			diagnostic.source = DIAGNOSTIC_SOURCE
			diagnostics.push(diagnostic)
		}
	}
}

function findParentScope(scopes: TemplateScope[], child: TemplateScope): TemplateScope | null {
	let best: TemplateScope | null = null
	for (const scope of scopes) {
		if (scope === child) continue
		if (child.startOffset >= scope.startOffset && child.endOffset <= scope.endOffset) {
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
	}
	return best
}
function getIgnoredRanges(text: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = []
	HTML_COMMENT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = HTML_COMMENT_REGEX.exec(text)) !== null) {
		ranges.push({ start: match.index, end: match.index + match[0].length })
	}

	const scriptStyleRegex = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi
	let scriptMatch: RegExpExecArray | null
	while ((scriptMatch = scriptStyleRegex.exec(text)) !== null) {
		const tagName = scriptMatch[1]
		const closeTagLen = `</${tagName}>`.length
		const contentLen = scriptMatch[2].length
		const start = scriptMatch.index + scriptMatch[0].length - closeTagLen - contentLen
		const end = start + contentLen
		ranges.push({ start, end })
	}

	return ranges
}

function isInRanges(offset: number, ranges: Array<{ start: number; end: number }>): boolean {
	for (const range of ranges) {
		if (offset >= range.start && offset < range.end) return true
	}
	return false
}
