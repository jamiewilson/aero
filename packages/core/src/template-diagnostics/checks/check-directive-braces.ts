import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic } from '../aero-diagnostic-build'
import type { SourceDocument } from '../source-document'
/**
 * Diagnostic check: directive attributes must use brace-wrapped expressions.
 */
import {
	getBuildDirectiveValidationIssue,
	looksBracedDirectiveValue,
	normalizeAttributeValue,
	resolveBuildDirectiveName,
} from '@aero-js/compiler/build-directive-attributes'
import {
	getRuntimeDirectiveBraceIssue,
	parseEventDirectiveName,
	resolveRuntimeDirectiveHasValue,
} from '@aero-js/compiler'
import { parseAeroHtmlDocument, type Node } from '@aero-js/html-parser'
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
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	start: number,
	end: number,
	message: string
): void {
	pushOffsetDiagnostic(diagnostics, document, start, end, message, 'AERO_COMPILE', 'error')
}

export function checkDirectiveExpressionBraces(
	document: SourceDocument,
	text: string,
	diagnostics: AeroDiagnostic[]
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
			const attrRange = findAttributeRange(rawAttrs, attrBase, attrName)
			if (!attrRange) continue

			const hasValue = resolveRuntimeDirectiveHasValue(
				attrName,
				rawParserValue,
				rawAttrs
			)
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

			const runtimeBraceIssue = getRuntimeDirectiveBraceIssue({
				attrName,
				rawValue: attrValue,
				hasValue,
			})
			if (runtimeBraceIssue) {
				pushDirectiveDiagnostic(
					document,
					diagnostics,
					attrRange.start,
					attrRange.end,
					runtimeBraceIssue
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

			// Bare `on:click` (no `=`) is left alone; empty/`non-braced` values must be braced.
			if (!hasValue && rawParserValue == null) continue

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
