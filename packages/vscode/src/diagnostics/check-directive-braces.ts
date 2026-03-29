/**
 * Diagnostic check: directive attributes must use brace-wrapped expressions.
 */
import * as vscode from 'vscode'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'
import { getIgnoredRanges, isInRanges } from './helpers'

/** Matches opening tags and captures the attributes part */
const OPEN_TAG_REGEX = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b([^>]*?)\/?>/gi

/** Matches directive attributes with explicit values */
const DIRECTIVE_ATTR_VALUE_REGEX =
	/\b(data-if|if|data-else-if|else-if|data-for|for|data-props|props)\s*=\s*(['"])(.*?)\2/gi

const BRACED_DIRECTIVES = new Set([
	'if',
	'data-if',
	'else-if',
	'data-else-if',
	'for',
	'data-for',
	'props',
	'data-props',
])

export function checkDirectiveExpressionBraces(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[]
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

			if (!BRACED_DIRECTIVES.has(attrName)) continue
			if (attrValue.startsWith('{') && attrValue.endsWith('}')) continue

			const attrsStart = tagStart + match[0].indexOf(attrs)
			const start = attrsStart + attrMatch.index
			const end = start + attrMatch[0].length
			const example = `${attrName}="{ expression }"`
			const diagnostic = new vscode.Diagnostic(
				new vscode.Range(document.positionAt(start), document.positionAt(end)),
				`Directive \`${attrName}\` must use a braced expression, e.g. ${example}`,
				vscode.DiagnosticSeverity.Error
			)
			applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
			diagnostics.push(diagnostic)
		}
	}
}
