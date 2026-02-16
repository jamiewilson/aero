import * as vscode from 'vscode'
import * as fs from 'node:fs'
import { getResolver } from './pathResolver'
import { COMPONENT_SUFFIX_REGEX } from './constants'
import { isAeroDocument } from './scope'

const DIAGNOSTIC_SOURCE = 'aero'

// ---------------------------------------------------------------------------
// Regex patterns for diagnostics
// ---------------------------------------------------------------------------

/** Matches <script ...> tags with their attributes */
const SCRIPT_TAG_REGEX = /<script\b([^>]*)>/gi

/** Matches on:build or on:client in attributes */
const ON_ATTR_REGEX = /\bon:(build|client)\b/

/** Matches src= in script attributes (external scripts are exempt) */
const SRC_ATTR_REGEX = /\bsrc\s*=/

/** Matches control flow attributes */
const IF_ATTR_REGEX = /\b(?:data-)?if(?:\s*=)/
const ELSE_IF_ATTR_REGEX = /\b(?:data-)?else-if(?:\s*=)/
const ELSE_ATTR_REGEX = /\b(?:data-)?else\b/

/** Matches opening tags and captures the attributes part */
const OPEN_TAG_REGEX = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b([^>]*?)\/?>/gi

/** Matches directive attributes with explicit values */
const DIRECTIVE_ATTR_VALUE_REGEX =
	/\b(data-if|if|data-else-if|else-if|data-each|each|data-props|props)\s*=\s*(['"])(.*?)\2/gi

/** Matches HTML comment blocks */
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g

/** Matches opening tags with component/layout suffix */
const COMPONENT_TAG_OPEN_REGEX =
	/<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\/?>/gi

// ---------------------------------------------------------------------------
// Diagnostics class
// ---------------------------------------------------------------------------

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
		const commentRanges = getCommentRanges(text)

		OPEN_TAG_REGEX.lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = OPEN_TAG_REGEX.exec(text)) !== null) {
			const tagStart = match.index
			if (isInRanges(tagStart, commentRanges)) continue

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
	// 1. Script tags without on:build or on:client
	// -----------------------------------------------------------------------

	private checkScriptTags(
		document: vscode.TextDocument,
		text: string,
		diagnostics: vscode.Diagnostic[],
	): void {
		SCRIPT_TAG_REGEX.lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = SCRIPT_TAG_REGEX.exec(text)) !== null) {
			const attrs = match[1]

			// Skip external scripts (have src attribute)
			if (SRC_ATTR_REGEX.test(attrs)) continue

			// Skip scripts in <head> that might be third-party
			// Simple heuristic: check if position is within <head>...</head>
			const pos = match.index
			const beforeText = text.slice(0, pos)
			const headOpen = beforeText.lastIndexOf('<head')
			const headClose = beforeText.lastIndexOf('</head')
			if (headOpen > headClose) {
				// Inside <head> -- allow scripts without on: attribute
				continue
			}

			// Check for on:build or on:client
			if (!ON_ATTR_REGEX.test(attrs)) {
				const startPos = document.positionAt(match.index)
				const endPos = document.positionAt(match.index + match[0].length)
				const diagnostic = new vscode.Diagnostic(
					new vscode.Range(startPos, endPos),
					'Inline <script> should have on:build or on:client attribute',
					vscode.DiagnosticSeverity.Warning,
				)
				diagnostic.source = DIAGNOSTIC_SOURCE
				diagnostics.push(diagnostic)
			}
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
		let lastConditionalType: 'if' | 'else-if' | null = null
		const commentRanges = getCommentRanges(text)

		OPEN_TAG_REGEX.lastIndex = 0
		let match: RegExpExecArray | null
		let previousTagEnd = 0

		while ((match = OPEN_TAG_REGEX.exec(text)) !== null) {
			const tagStart = match.index
			if (isInRanges(tagStart, commentRanges)) continue

			const between = stripComments(text.slice(previousTagEnd, tagStart))
			if (/<[a-z]/i.test(between)) {
				lastConditionalType = null
			}

			previousTagEnd = tagStart + match[0].length

			const attrs = match[2] || ''
			if (!attrs) {
				lastConditionalType = null
				continue
			}

			if (IF_ATTR_REGEX.test(attrs) && !ELSE_IF_ATTR_REGEX.test(attrs)) {
				lastConditionalType = 'if'
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
				lastConditionalType = 'else-if'
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
				lastConditionalType = null
				continue
			}

			lastConditionalType = null
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

		COMPONENT_TAG_OPEN_REGEX.lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = COMPONENT_TAG_OPEN_REGEX.exec(text)) !== null) {
			const tagName = match[1]
			const suffixMatch = COMPONENT_SUFFIX_REGEX.exec(tagName)
			if (!suffixMatch) continue

			const suffix = suffixMatch[1] as 'component' | 'layout'
			const baseName = tagName.replace(COMPONENT_SUFFIX_REGEX, '')
			const alias = suffix === 'component' ? `@components/${baseName}` : `@layouts/${baseName}`

			const resolved = resolver.resolve(alias, document.uri.fsPath)
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
}

function getCommentRanges(text: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = []
	HTML_COMMENT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = HTML_COMMENT_REGEX.exec(text)) !== null) {
		ranges.push({ start: match.index, end: match.index + match[0].length })
	}
	return ranges
}

function isInRanges(offset: number, ranges: Array<{ start: number; end: number }>): boolean {
	for (const range of ranges) {
		if (offset >= range.start && offset < range.end) return true
	}
	return false
}

function stripComments(text: string): string {
	return text.replace(HTML_COMMENT_REGEX, '')
}
