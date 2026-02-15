import * as vscode from 'vscode'
import * as fs from 'node:fs'
import { getResolver } from './pathResolver'
import { COMPONENT_SUFFIX_REGEX } from './constants'

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

/** Matches opening tags with component/layout suffix */
const COMPONENT_TAG_OPEN_REGEX = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\/?>/gi

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
			vscode.workspace.onDidOpenTextDocument((doc) => this.updateDiagnostics(doc)),
			vscode.workspace.onDidSaveTextDocument((doc) => this.updateDiagnostics(doc)),
			vscode.workspace.onDidChangeTextDocument((e) => this.updateDiagnostics(e.document)),
			vscode.workspace.onDidCloseTextDocument((doc) => this.collection.delete(doc.uri)),
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
		if (document.languageId !== 'html') return

		const diagnostics: vscode.Diagnostic[] = []
		const text = document.getText()

		this.checkScriptTags(document, text, diagnostics)
		this.checkConditionalChains(document, text, diagnostics)
		this.checkComponentReferences(document, text, diagnostics)

		this.collection.set(document.uri, diagnostics)
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
		const lines = text.split('\n')

		let lastConditionalType: 'if' | 'else-if' | null = null

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// Check for opening tags with conditional attributes
			if (IF_ATTR_REGEX.test(line) && !ELSE_IF_ATTR_REGEX.test(line)) {
				lastConditionalType = 'if'
				continue
			}

			if (ELSE_IF_ATTR_REGEX.test(line)) {
				if (lastConditionalType !== 'if' && lastConditionalType !== 'else-if') {
					const col = line.search(/(?:data-)?else-if/)
					if (col >= 0) {
						const match = line.match(/(?:data-)?else-if/)
						const len = match ? match[0].length : 7
						const diagnostic = new vscode.Diagnostic(
							new vscode.Range(i, col, i, col + len),
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

			if (ELSE_ATTR_REGEX.test(line) && !ELSE_IF_ATTR_REGEX.test(line)) {
				if (lastConditionalType !== 'if' && lastConditionalType !== 'else-if') {
					const col = line.search(/(?:data-)?else\b/)
					if (col >= 0) {
						const match = line.match(/(?:data-)?else\b/)
						const len = match ? match[0].length : 4
						const diagnostic = new vscode.Diagnostic(
							new vscode.Range(i, col, i, col + len),
							'else must follow an element with if or else-if',
							vscode.DiagnosticSeverity.Error,
						)
						diagnostic.source = DIAGNOSTIC_SOURCE
						diagnostics.push(diagnostic)
					}
				}
				lastConditionalType = null // else terminates the chain
				continue
			}

			// Non-conditional, non-whitespace lines reset the chain
			if (line.trim().length > 0 && /<[a-z]/i.test(line)) {
				lastConditionalType = null
			}
		}
	}

	// -----------------------------------------------------------------------
	// 3. Missing component/layout files
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
			const alias =
				suffix === 'component'
					? `@components/${baseName}`
					: `@layouts/${baseName}`

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
