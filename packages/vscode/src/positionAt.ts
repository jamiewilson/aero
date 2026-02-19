import * as vscode from 'vscode'
import { IMPORT_REGEX, COMPONENT_SUFFIX_REGEX, CONTENT_GLOBALS } from './constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PositionKind =
	| { kind: 'import-path'; specifier: string; range: vscode.Range }
	| { kind: 'import-name'; name: string; specifier: string; range: vscode.Range }
	| { kind: 'script-src'; value: string; range: vscode.Range }
	| { kind: 'link-href'; value: string; range: vscode.Range }
	| {
			kind: 'component-tag'
			tagName: string
			baseName: string
			suffix: 'component' | 'layout'
			range: vscode.Range
	  }
	| {
			kind: 'content-global'
			identifier: string
			alias: string
			propertyPath: string[]
			range: vscode.Range
	  }
	| { kind: 'expression-identifier'; identifier: string; range: vscode.Range }
	| null

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

/**
 * Classify what the cursor is on at the given position in an HTML document.
 * Returns a descriptor or null if nothing Aero-specific is detected.
 */
export function classifyPosition(
	document: vscode.TextDocument,
	position: vscode.Position,
): PositionKind {
	const line = document.lineAt(position.line)
	const lineText = line.text
	const offset = position.character

	// 1. Check for import path or imported name
	const importResult = getImportAt(lineText, position.line, offset)
	if (importResult) return importResult

	// 2. Check for <script src="..."> or <link href="...">
	const assetResult = getAssetRefAt(lineText, position.line, offset)
	if (assetResult) return assetResult

	// 3. Check for component/layout tag name
	const tagResult = getComponentTagAt(document, position)
	if (tagResult) return tagResult

	// 4. Check for content globals / identifiers in { } expressions
	const exprResult = getExpressionIdentifierAt(document, position)
	if (exprResult) return exprResult

	return null
}

// ---------------------------------------------------------------------------
// Import path / imported name detection
// ---------------------------------------------------------------------------

function getImportAt(lineText: string, lineNum: number, offset: number): PositionKind {
	// Reset regex state
	IMPORT_REGEX.lastIndex = 0

	let match: RegExpExecArray | null
	while ((match = IMPORT_REGEX.exec(lineText)) !== null) {
		const fullMatchStart = match.index
		const fullMatchEnd = fullMatchStart + match[0].length
		if (offset < fullMatchStart || offset > fullMatchEnd) continue

		const specifier = match[6]
		const quote = match[5]
		// Find the specifier string position within the match
		const specStart = match[0].lastIndexOf(quote + specifier + quote)
		const specifierStart = fullMatchStart + specStart + 1 // +1 for opening quote
		const specifierEnd = specifierStart + specifier.length

		// Is cursor inside the specifier string?
		if (offset >= specifierStart && offset <= specifierEnd) {
			return {
				kind: 'import-path',
				specifier,
				range: new vscode.Range(lineNum, specifierStart, lineNum, specifierEnd),
			}
		}

		// Is cursor on the imported name?
		const defaultImport = match[2]
		const namedImports = match[3]
		const namespaceImport = match[4]

		if (defaultImport) {
			const nameStart = lineText.indexOf(defaultImport, fullMatchStart)
			const nameEnd = nameStart + defaultImport.length
			if (offset >= nameStart && offset <= nameEnd) {
				return {
					kind: 'import-name',
					name: defaultImport,
					specifier,
					range: new vscode.Range(lineNum, nameStart, lineNum, nameEnd),
				}
			}
		}

		if (namespaceImport) {
			const nameStart = lineText.indexOf(namespaceImport, fullMatchStart)
			const nameEnd = nameStart + namespaceImport.length
			if (offset >= nameStart && offset <= nameEnd) {
				return {
					kind: 'import-name',
					name: namespaceImport,
					specifier,
					range: new vscode.Range(lineNum, nameStart, lineNum, nameEnd),
				}
			}
		}

		if (namedImports) {
			const names = namedImports.split(',').map(n => n.trim())
			for (const name of names) {
				if (!name) continue
				// Handle `as` aliases: `import { foo as bar } from '...'`
				const realName = name.split(/\s+as\s+/)[0].trim()
				const nameStart = lineText.indexOf(realName, fullMatchStart)
				const nameEnd = nameStart + realName.length
				if (offset >= nameStart && offset <= nameEnd) {
					return {
						kind: 'import-name',
						name: realName,
						specifier,
						range: new vscode.Range(lineNum, nameStart, lineNum, nameEnd),
					}
				}
			}
		}
	}

	return null
}

// ---------------------------------------------------------------------------
// Asset reference detection (<script src>, <link href>)
// ---------------------------------------------------------------------------

const SCRIPT_SRC_REGEX = /<script[^>]*?\bsrc\s*=\s*(['"])(.*?)\1/gi
const LINK_HREF_REGEX = /<link[^>]*?\bhref\s*=\s*(['"])(.*?)\1/gi

function getAssetRefAt(lineText: string, lineNum: number, offset: number): PositionKind {
	// Check <script src="...">
	SCRIPT_SRC_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = SCRIPT_SRC_REGEX.exec(lineText)) !== null) {
		const value = match[2]
		const valueStart = match.index + match[0].lastIndexOf(match[1] + value + match[1]) + 1
		const valueEnd = valueStart + value.length
		if (offset >= valueStart && offset <= valueEnd) {
			return {
				kind: 'script-src',
				value,
				range: new vscode.Range(lineNum, valueStart, lineNum, valueEnd),
			}
		}
	}

	// Check <link href="...">
	LINK_HREF_REGEX.lastIndex = 0
	while ((match = LINK_HREF_REGEX.exec(lineText)) !== null) {
		const value = match[2]
		const valueStart = match.index + match[0].lastIndexOf(match[1] + value + match[1]) + 1
		const valueEnd = valueStart + value.length
		if (offset >= valueStart && offset <= valueEnd) {
			return {
				kind: 'link-href',
				value,
				range: new vscode.Range(lineNum, valueStart, lineNum, valueEnd),
			}
		}
	}

	return null
}

// ---------------------------------------------------------------------------
// Component/layout tag detection
// ---------------------------------------------------------------------------

const TAG_NAME_REGEX = /<\/?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/gi

function getComponentTagAt(
	document: vscode.TextDocument,
	position: vscode.Position,
): PositionKind {
	const lineText = document.lineAt(position.line).text
	const offset = position.character

	TAG_NAME_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = TAG_NAME_REGEX.exec(lineText)) !== null) {
		const tagName = match[1]
		// Calculate position of the tag name (after </ or <)
		const tagNameStart = match.index + match[0].length - tagName.length
		const tagNameEnd = tagNameStart + tagName.length

		if (offset >= tagNameStart && offset <= tagNameEnd) {
			const suffixMatch = COMPONENT_SUFFIX_REGEX.exec(tagName)
			if (suffixMatch) {
				const suffix = suffixMatch[1] as 'component' | 'layout'
				const baseName = tagName.replace(COMPONENT_SUFFIX_REGEX, '')
				return {
					kind: 'component-tag',
					tagName,
					baseName,
					suffix,
					range: new vscode.Range(position.line, tagNameStart, position.line, tagNameEnd),
				}
			}
		}
	}

	return null
}

// ---------------------------------------------------------------------------
// Expression identifier detection (with dot-chain support)
// ---------------------------------------------------------------------------

/**
 * Detect whether the cursor is on a known content global (like `site`) or on
 * a dot-chain rooted at a content global (like `site.home.title`) inside a
 * `{ ... }` expression.
 *
 * For `{ site.home.title }` with cursor on any of `site`, `home`, or `title`:
 * - Returns kind 'content-global' with the full dot-chain parsed
 * - propertyPath contains the segments after the root (e.g. ['home', 'title'])
 * - range covers the portion from the root through the segment under cursor
 */
function getExpressionIdentifierAt(
	document: vscode.TextDocument,
	position: vscode.Position,
): PositionKind {
	const lineText = document.lineAt(position.line).text
	const offset = position.character

	const expressionRange = getExpressionContextRangeAt(document, position, lineText, offset)
	if (!expressionRange) {
		return null
	}

	// Find the full dot-chain at/around the cursor position.
	// A dot-chain is something like `site.home.title` -- identifiers joined by dots.
	const chain = getDotChainAtPosition(lineText, offset)
	if (!chain) return null
	const chainEnd = chain.start + chain.text.length
	if (chain.start < expressionRange.start || chainEnd > expressionRange.end) {
		return null
	}

	// Parse the chain into segments
	const segments = chain.text.split('.')
	const rootIdentifier = segments[0]

	// Check if the root is a known content global
	if (rootIdentifier in CONTENT_GLOBALS) {
		// Determine which segment the cursor is on, and build the propertyPath
		// up to that segment for targeted navigation
		const cursorOffsetInChain = offset - chain.start
		let runningOffset = 0
		let cursorSegmentIndex = 0

		for (let i = 0; i < segments.length; i++) {
			const segEnd = runningOffset + segments[i].length
			if (cursorOffsetInChain <= segEnd) {
				cursorSegmentIndex = i
				break
			}
			runningOffset = segEnd + 1 // +1 for the dot
		}

		// propertyPath = segments after root, up to and including the cursor segment
		const propertyPath = segments.slice(1, cursorSegmentIndex + 1)

		// The range covers from the root through the segment under cursor
		// so option+hover underlines a meaningful chunk
		let rangeEnd = chain.start
		for (let i = 0; i <= cursorSegmentIndex; i++) {
			rangeEnd += segments[i].length
			if (i < cursorSegmentIndex) rangeEnd += 1 // dot
		}

		return {
			kind: 'content-global',
			identifier: rootIdentifier,
			alias: CONTENT_GLOBALS[rootIdentifier],
			propertyPath,
			range: new vscode.Range(position.line, chain.start, position.line, rangeEnd),
		}
	}

	// Not a content global -- return as generic expression identifier
	const wordRange = getWordRangeAtPosition(lineText, position.line, offset)
	if (!wordRange) return null
	const word = lineText.slice(wordRange.start.character, wordRange.end.character)

	return {
		kind: 'expression-identifier',
		identifier: word,
		range: wordRange,
	}
}

/**
 * Returns the active expression context around the cursor:
 * - `{ ... }` interpolation expressions
 * - expression-valued Aero attributes like `if="{ props.showLogo }"`
 */
function getExpressionContextRangeAt(
	document: vscode.TextDocument,
	position: vscode.Position,
	lineText: string,
	offset: number,
): { start: number; end: number } | null {
	if (isInsideInlineScript(document, position)) {
		return { start: 0, end: lineText.length }
	}

	if (isInsideCurlyExpression(lineText, offset)) {
		return { start: 0, end: lineText.length }
	}

	const attrRange = getAeroExpressionAttributeValueRangeAt(lineText, offset)
	if (attrRange) return attrRange

	return null
}

/**
 * Check whether the cursor is inside the content of an inline <script> block.
 */
function isInsideInlineScript(
	document: vscode.TextDocument,
	position: vscode.Position,
): boolean {
	const text = document.getText()
	const offset = document.offsetAt(position)
	const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

	let match: RegExpExecArray | null
	while ((match = scriptRegex.exec(text)) !== null) {
		const attrs = (match[1] || '').toLowerCase()
		if (/\bsrc\s*=/.test(attrs)) continue

		const content = match[2] || ''
		const contentStart = match.index + match[0].indexOf(content)
		const contentEnd = contentStart + content.length
		if (offset >= contentStart && offset <= contentEnd) {
			return true
		}
	}

	return false
}

/**
 * Check whether the cursor is inside an Aero expression attribute value.
 * Supports: if/else-if/each and data-if/data-else-if/data-each.
 */
function getAeroExpressionAttributeValueRangeAt(
	lineText: string,
	offset: number,
): { start: number; end: number } | null {
	const attrValueRegex =
		/\b(?:data-if|if|data-else-if|else-if|data-each|each)\s*=\s*(['"])(.*?)\1/gi

	let match: RegExpExecArray | null
	while ((match = attrValueRegex.exec(lineText)) !== null) {
		const value = match[2]
		const valueStart = match.index + match[0].lastIndexOf(match[1] + value + match[1]) + 1
		const openBraceOffset = value.indexOf('{')
		const closeBraceOffset = value.lastIndexOf('}')

		if (
			openBraceOffset === -1 ||
			closeBraceOffset === -1 ||
			closeBraceOffset <= openBraceOffset
		) {
			continue
		}

		const exprStart = valueStart + openBraceOffset + 1
		const exprEnd = valueStart + closeBraceOffset
		if (offset >= exprStart && offset <= exprEnd) {
			return { start: exprStart, end: exprEnd }
		}
	}

	return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if offset is inside a { ... } expression by counting unmatched braces
 * walking backwards from the offset.
 */
function isInsideCurlyExpression(lineText: string, offset: number): boolean {
	let braceDepth = 0
	for (let i = offset - 1; i >= 0; i--) {
		const ch = lineText[i]
		if (ch === '}') braceDepth++
		if (ch === '{') {
			if (braceDepth === 0) return true
			braceDepth--
		}
	}
	return false
}

/**
 * Find the full dot-chain (e.g. `site.home.title`) at the given offset.
 * Returns the text and start position, or null.
 */
function getDotChainAtPosition(
	lineText: string,
	offset: number,
): { text: string; start: number } | null {
	// First, verify the cursor is on an identifier or dot character
	const ch = lineText[offset]
	const prevCh = offset > 0 ? lineText[offset - 1] : ''
	if (!isIdentChar(ch) && ch !== '.' && !isIdentChar(prevCh)) {
		return null
	}

	// Expand left from offset to find the start of the dot-chain
	let start = offset
	while (start > 0) {
		const c = lineText[start - 1]
		if (isIdentChar(c) || c === '.') {
			start--
		} else {
			break
		}
	}

	// Expand right from offset to find the end of the dot-chain
	let end = offset
	while (end < lineText.length) {
		const c = lineText[end]
		if (isIdentChar(c) || c === '.') {
			end++
		} else {
			break
		}
	}

	const text = lineText.slice(start, end)

	// Trim leading/trailing dots (shouldn't happen but be safe)
	const trimmed = text.replace(/^\.+|\.+$/g, '')
	if (!trimmed || (!trimmed.includes('.') && !isIdentStart(trimmed[0]))) {
		// Single word with no dots -- fall through to simple word matching
		if (trimmed && isIdentStart(trimmed[0])) {
			const trimStart = start + text.indexOf(trimmed)
			return { text: trimmed, start: trimStart }
		}
		return null
	}

	const trimStart = start + text.indexOf(trimmed)
	return { text: trimmed, start: trimStart }
}

function isIdentChar(ch: string | undefined): boolean {
	if (!ch) return false
	return /[a-zA-Z0-9_$]/.test(ch)
}

function isIdentStart(ch: string | undefined): boolean {
	if (!ch) return false
	return /[a-zA-Z_$]/.test(ch)
}

function getWordRangeAtPosition(
	lineText: string,
	lineNum: number,
	offset: number,
): vscode.Range | null {
	const identRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*/g
	let match: RegExpExecArray | null
	while ((match = identRegex.exec(lineText)) !== null) {
		const start = match.index
		const end = start + match[0].length
		if (offset >= start && offset <= end) {
			return new vscode.Range(lineNum, start, lineNum, end)
		}
	}
	return null
}
