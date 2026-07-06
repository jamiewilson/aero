import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { resolveBuildDirectiveName } from '@aero-js/compiler/build-directive-attributes'
import { ATTR_ELSE, ATTR_ELSE_IF, ATTR_IF } from '@aero-js/compiler/constants'
import { parseAeroHtmlDocument, type Node } from '@aero-js/html-parser'
import { pushOffsetDiagnostic } from '../aero-diagnostic-build'
import type { SourceDocument } from '../source-document'
/**
 * Diagnostic check: orphaned else-if / else without preceding if.
 */
import {
	attributeSectionBase,
	findAttributeRange,
	getIgnoredRanges,
	isInRanges,
	sliceRawAttrs,
} from './helpers'

type ConditionalDirective = typeof ATTR_IF | typeof ATTR_ELSE_IF | typeof ATTR_ELSE

function getConditionalDirective(node: Node): ConditionalDirective | null {
	const attrs = node.attributes
	if (!attrs) return null
	for (const attrName of Object.keys(attrs)) {
		const directive = resolveBuildDirectiveName(attrName)
		if (directive === ATTR_IF || directive === ATTR_ELSE_IF || directive === ATTR_ELSE) {
			return directive
		}
	}
	return null
}

function pushOrphanedConditionalDiagnostic(
	document: SourceDocument,
	text: string,
	node: Node,
	directive: typeof ATTR_ELSE_IF | typeof ATTR_ELSE,
	diagnostics: AeroDiagnostic[]
): void {
	if (node.start == null || node.startTagEnd == null || !node.tag) return

	const fullTag = text.slice(node.start, node.startTagEnd)
	const nameMatch = fullTag.match(/^<\s*\/?\s*([a-zA-Z][\w-]*)/)
	if (!nameMatch) return

	const rawAttrs = sliceRawAttrs(nameMatch[1], fullTag)
	const attrBase = attributeSectionBase(node.start, nameMatch[1])

	for (const attrName of Object.keys(node.attributes ?? {})) {
		if (resolveBuildDirectiveName(attrName) !== directive) continue
		const attrRange = findAttributeRange(rawAttrs, attrBase, attrName)
		if (!attrRange) continue
		pushOffsetDiagnostic(
			diagnostics,
			document,
			attrRange.start,
			attrRange.end,
			directive === ATTR_ELSE_IF
				? 'else-if must follow an element with if or else-if'
				: 'else must follow an element with if or else-if',
			'AERO_COMPILE',
			'error'
		)
		return
	}
}

function checkSiblingConditionalChains(
	document: SourceDocument,
	text: string,
	nodes: Node[],
	diagnostics: AeroDiagnostic[],
	ignoredRanges: { start: number; end: number }[]
): void {
	let lastConditional: typeof ATTR_IF | typeof ATTR_ELSE_IF | null = null

	for (const node of nodes) {
		if (node.start != null && isInRanges(node.start, ignoredRanges)) continue

		const directive = node.tag ? getConditionalDirective(node) : null
		if (directive === ATTR_IF) {
			lastConditional = ATTR_IF
		} else if (directive === ATTR_ELSE_IF) {
			if (lastConditional !== ATTR_IF && lastConditional !== ATTR_ELSE_IF) {
				pushOrphanedConditionalDiagnostic(document, text, node, ATTR_ELSE_IF, diagnostics)
			}
			lastConditional = ATTR_ELSE_IF
		} else if (directive === ATTR_ELSE) {
			if (lastConditional !== ATTR_IF && lastConditional !== ATTR_ELSE_IF) {
				pushOrphanedConditionalDiagnostic(document, text, node, ATTR_ELSE, diagnostics)
			}
			lastConditional = null
		} else if (node.tag) {
			lastConditional = null
		}

		if (node.children?.length) {
			checkSiblingConditionalChains(document, text, node.children, diagnostics, ignoredRanges)
		}
	}
}

export function checkConditionalChains(
	document: SourceDocument,
	text: string,
	diagnostics: AeroDiagnostic[]
): void {
	const ignoredRanges = getIgnoredRanges(text)
	const htmlDoc = parseAeroHtmlDocument(text, document.uri.toString())
	checkSiblingConditionalChains(document, text, htmlDoc.roots, diagnostics, ignoredRanges)
}
