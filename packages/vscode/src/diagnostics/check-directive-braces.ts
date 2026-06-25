/**
 * Diagnostic check: directive attributes must use brace-wrapped expressions.
 */
import { requiresBracedDirectiveValue } from '@aero-js/compiler/build-directive-attributes'
import * as vscode from 'vscode'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'
import { getIgnoredRanges, isInRanges } from './helpers'

/** Matches opening tags and captures the attributes part */
const OPEN_TAG_REGEX = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b([^>]*?)\/?>/gi

/** Matches directive attributes with explicit values */
const DIRECTIVE_ATTR_VALUE_REGEX =
	/\b((?:data-aero-|aero-)?(?:if|else-if|for|props))\s*=\s*(['"])(.*?)\2/gi

/** Matches event directive attributes with explicit values */
const EVENT_DIRECTIVE_ATTR_VALUE_REGEX =
	/\b((?:data-aero-|aero-)?on[:\-][a-z0-9_.:-]+)\s*=\s*(['"])(.*?)\2/gi

function isSingleBracedExpression(value: string): boolean {
	const trimmed = value.trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.length >= 2
}

function parseEventDirectiveNameForDiagnostics(
	attrName: string
): { kind: 'ok' } | { kind: 'invalid'; message: string } {
	const trimmed = attrName.trim()
	const body = trimmed
		.replace(/^data-aero-/, '')
		.replace(/^aero-/, '')
		.replace(/^on[:-]/, '')

	if (!body) {
		return {
			kind: 'invalid',
			message: 'Event directive must include an event name (e.g. on:click).',
		}
	}
	if (body.startsWith('.') || body.endsWith('.') || body.includes('..')) {
		return {
			kind: 'invalid',
			message: 'Event directive has malformed modifier chain (empty modifier segment).',
		}
	}
	return { kind: 'ok' }
}

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

		const tagName = (match[1] || '').toLowerCase()
		const attrs = match[2] || ''
		if (!attrs) continue

		const attrsStart = tagStart + match[0].indexOf(attrs)

		DIRECTIVE_ATTR_VALUE_REGEX.lastIndex = 0
		let attrMatch: RegExpExecArray | null
		while ((attrMatch = DIRECTIVE_ATTR_VALUE_REGEX.exec(attrs)) !== null) {
			const attrName = attrMatch[1]
			const attrValue = (attrMatch[3] || '').trim()

			if (!requiresBracedDirectiveValue(attrName, attrValue, tagName)) continue

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

		EVENT_DIRECTIVE_ATTR_VALUE_REGEX.lastIndex = 0
		while ((attrMatch = EVENT_DIRECTIVE_ATTR_VALUE_REGEX.exec(attrs)) !== null) {
			const attrName = attrMatch[1]
			const attrValue = (attrMatch[3] || '').trim()
			const parsed = parseEventDirectiveNameForDiagnostics(attrName)

			const start = attrsStart + attrMatch.index
			const end = start + attrMatch[0].length

			if (parsed.kind === 'invalid') {
				const diagnostic = new vscode.Diagnostic(
					new vscode.Range(document.positionAt(start), document.positionAt(end)),
					`Directive \`${attrName}\` is invalid: ${parsed.message}`,
					vscode.DiagnosticSeverity.Error
				)
				applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
				diagnostics.push(diagnostic)
				continue
			}

			if (parsed.kind === 'ok' && !isSingleBracedExpression(attrValue)) {
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
}
