/**
 * Diagnostic check: orphaned else-if / else without preceding if.
 */
import * as vscode from 'vscode'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'
import { getIgnoredRanges, isInRanges } from './helpers'

/** Matches control flow attributes */
const IF_ATTR_REGEX = /\b(?:data-)?if(?:\s*=)/
const ELSE_IF_ATTR_REGEX = /\b(?:data-)?else-if(?:\s*=)/
const ELSE_ATTR_REGEX = /\b(?:data-)?else\b/

/** Matches opening and closing tags and captures attributes for opening tags */
const ANY_TAG_REGEX = /<\/?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b([^>]*?)\/?>/gi

/** HTML void elements that do not create a new nesting level */
const VOID_ELEMENTS = new Set([
	'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
	'link', 'meta', 'param', 'slot', 'source', 'track', 'wbr',
])

export function checkConditionalChains(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[]
): void {
	const lastConditionalTypeByDepth = new Map<number, 'if' | 'else-if' | null>()
	let depth = 0
	const ignoredRanges = getIgnoredRanges(text)

	ANY_TAG_REGEX.lastIndex = 0
	let match: RegExpExecArray | null

	const getLastConditionalType = (currentDepth: number): 'if' | 'else-if' | null => {
		return lastConditionalTypeByDepth.get(currentDepth) ?? null
	}

	const setLastConditionalType = (currentDepth: number, type: 'if' | 'else-if' | null): void => {
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
						vscode.DiagnosticSeverity.Error
					)
					applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
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
						vscode.DiagnosticSeverity.Error
					)
					applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
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
