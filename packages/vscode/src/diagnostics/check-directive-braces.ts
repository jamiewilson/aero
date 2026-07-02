/**
 * Diagnostic check: directive attributes must use brace-wrapped expressions.
 */
import {
	getBuildDirectiveValidationIssue,
	looksBracedDirectiveValue,
	normalizeAttributeValue,
	resolveBuildDirectiveName,
} from '@aero-js/compiler/build-directive-attributes'
import { parseEventDirectiveName } from '@aero-js/compiler'
import { parseAeroHtmlDocument, type Node } from '@aero-js/html-parser'
import * as vscode from 'vscode'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'
import {
	attributeSectionBase,
	findAttributeRange,
	getIgnoredRanges,
	isInRanges,
	sliceRawAttrs,
} from './helpers'

function nodeHasSwitchAttr(node: Node | null | undefined): boolean {
	const attrs = node?.attributes
	if (!attrs) return false
	for (const name of Object.keys(attrs)) {
		if (resolveBuildDirectiveName(name) === 'switch') return true
	}
	return false
}

function* walkElementsWithParent(
	nodes: Node[],
	parent: Node | null
): Generator<{ node: Node; parent: Node | null }> {
	for (const node of nodes) {
		yield { node, parent }
		if (node.children?.length) {
			yield* walkElementsWithParent(node.children, node)
		}
	}
}

function pushDirectiveDiagnostic(
	document: vscode.TextDocument,
	diagnostics: vscode.Diagnostic[],
	start: number,
	end: number,
	message: string
): void {
	const diagnostic = new vscode.Diagnostic(
		new vscode.Range(document.positionAt(start), document.positionAt(end)),
		message,
		vscode.DiagnosticSeverity.Error
	)
	applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
	diagnostics.push(diagnostic)
}

export function checkDirectiveExpressionBraces(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[]
): void {
	const ignoredRanges = getIgnoredRanges(text)
	const htmlDoc = parseAeroHtmlDocument(text, document.uri.toString())

	for (const { node, parent } of walkElementsWithParent(htmlDoc.roots, null)) {
		const attrs = node.attributes
		if (!attrs || node.start == null || node.startTagEnd == null || !node.tag) continue
		if (isInRanges(node.start, ignoredRanges)) continue

		const fullTag = text.slice(node.start, node.startTagEnd)
		const nameMatch = fullTag.match(/^<\s*\/?\s*([a-zA-Z][\w-]*)/)
		if (!nameMatch) continue

		const tagName = nameMatch[1].toLowerCase()
		const tagStart = node.start
		const rawAttrs = sliceRawAttrs(nameMatch[1], fullTag)
		const attrBase = attributeSectionBase(tagStart, nameMatch[1])
		const parentHasSwitch = nodeHasSwitchAttr(parent)

		for (const [attrName, rawParserValue] of Object.entries(attrs)) {
			if (rawParserValue == null) continue

			const attrRange = findAttributeRange(rawAttrs, attrBase, attrName)
			if (!attrRange) continue

			const attrValue = normalizeAttributeValue(rawParserValue)

			const buildIssue = getBuildDirectiveValidationIssue({
				tagName,
				attrName,
				rawValue: attrValue,
				parentHasSwitch,
			})
			if (buildIssue) {
				pushDirectiveDiagnostic(
					document,
					diagnostics,
					attrRange.start,
					attrRange.end,
					buildIssue
				)
				continue
			}

			const parsed = parseEventDirectiveName(attrName)
			if (parsed.kind === 'non-event') continue

			if (parsed.kind === 'invalid') {
				pushDirectiveDiagnostic(
					document,
					diagnostics,
					attrRange.start,
					attrRange.end,
					`Directive \`${attrName}\` is invalid: ${parsed.message}`
				)
				continue
			}

			if (!looksBracedDirectiveValue(attrValue)) {
				const example = `${attrName}="{ expression }"`
				pushDirectiveDiagnostic(
					document,
					diagnostics,
					attrRange.start,
					attrRange.end,
					`Directive \`${attrName}\` must use a braced expression, e.g. ${example}`
				)
			}
		}
	}
}
