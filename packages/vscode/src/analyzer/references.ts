import * as vscode from 'vscode'
import { maskScriptAndStyleInner, tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import { parseAeroTemplateDocument, walkHtmlNodes } from '@aero-js/html-parser'
import { walkTemplateAttributes } from '@aero-js/compiler'
import { parseScriptBlocks } from '../script-tag'
import { isInsideHtmlComment, maskJsComments, maskTemplateLiteralStatic } from './helpers'
import { isJsReservedIdentifier } from './js-keywords'
import type { TemplateReference } from './types'

const STANDALONE_ATTR_VARIABLE_REFS = new Set(['props', 'aero-props', 'data-aero-props'])

export function collectBuildScriptContentGlobalReferences(
	document: vscode.TextDocument,
	text: string,
	contentGlobalNames: ReadonlySet<string>
): TemplateReference[] {
	const refs: TemplateReference[] = []
	const buildBlocks = parseScriptBlocks(text).filter(
		b => b.kind === 'build' && !isInsideHtmlComment(text, b.tagStart)
	)

	for (const block of buildBlocks) {
		const maskedContent = maskJsComments(block.content)
		extractIdentifiers(maskedContent, block.contentStart, document, refs, false)
	}
	return refs.filter(r => contentGlobalNames.has(r.content))
}

export function collectTemplateReferences(
	document: vscode.TextDocument,
	text: string
): TemplateReference[] {
	const refs: TemplateReference[] = []

	let maskedText = maskScriptAndStyleInner(text)
	maskedText = maskedText.replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))

	const htmlDoc = parseAeroTemplateDocument(maskedText, document.uri.toString())
	for (const node of walkHtmlNodes(htmlDoc.roots)) {
		if (!node.tag || node.startTagEnd == null) continue
		const tl = node.tag.toLowerCase()
		if (tl === 'script' || tl === 'style') continue
		if (isInsideHtmlComment(text, node.start)) continue

		const open = text.slice(node.start, node.startTagEnd)
		const nameMatch = open.match(/^<\s*\/?\s*([a-zA-Z][\w-]*)/)
		if (!nameMatch) continue
		const tagName = nameMatch[1]

		if (tagName.endsWith('-component') || tagName.endsWith('-layout')) {
			const suffix = tagName.endsWith('-component') ? '-component' : '-layout'
			const prefix = tagName.slice(0, -suffix.length)
			const nameStartInOpen = nameMatch.index! + nameMatch[0].length - tagName.length
			const absPrefixStart = node.start + nameStartInOpen

			refs.push({
				content: prefix.replace(/-([a-z])/g, g => g[1].toUpperCase()),
				range: new vscode.Range(
					document.positionAt(absPrefixStart),
					document.positionAt(absPrefixStart + prefix.length)
				),
				offset: absPrefixStart,
				isAttribute: false,
				isComponent: true,
			})
		}
	}

	const maskRange = (start: number, length: number) => {
		maskedText =
			maskedText.substring(0, start) + ' '.repeat(length) + maskedText.substring(start + length)
	}

	for (const attr of walkTemplateAttributes(htmlDoc.roots, text)) {
		if (!attr.hasValue) {
			if (STANDALONE_ATTR_VARIABLE_REFS.has(attr.name)) {
				refs.push({
					content: 'props',
					range: new vscode.Range(
						document.positionAt(attr.absNameStart),
						document.positionAt(attr.absNameStart + attr.name.length)
					),
					offset: attr.absNameStart,
					isAttribute: true,
				})
			}
			continue
		}

		if (attr.isAlpine) {
			extractIdentifiers(attr.value, attr.absValueStart, document, refs, true, true)
			maskRange(attr.absValueStart, attr.value.length)
			continue
		}

		const segments = tokenizeCurlyInterpolation(attr.value, { attributeMode: true })
		for (const seg of segments) {
			if (seg.kind === 'interpolation') {
				const contentStart = attr.absValueStart + seg.start + 1
				extractIdentifiers(seg.expression, contentStart, document, refs, true)
			}
		}
		maskRange(attr.absValueStart, attr.value.length)
	}

	const contentSegments = tokenizeCurlyInterpolation(maskedText, { attributeMode: false })
	for (const seg of contentSegments) {
		if (seg.kind === 'interpolation') {
			const contentStart = seg.start + 1
			extractIdentifiers(seg.expression, contentStart, document, refs, false)
		}
	}

	return refs
}

/** Collect identifier references from a JS/TS fragment (script body or expression). */
export function collectIdentifierReferences(
	document: vscode.TextDocument,
	content: string,
	startOffset: number,
	isAttribute = false
): TemplateReference[] {
	const refs: TemplateReference[] = []
	extractIdentifiers(content, startOffset, document, refs, isAttribute)
	return refs
}

function extractIdentifiers(
	content: string,
	startOffset: number,
	document: vscode.TextDocument,
	refs: TemplateReference[],
	isAttribute: boolean,
	isAlpine?: boolean
) {
	let maskedContent = maskJsComments(content)
	maskedContent = maskTemplateLiteralStatic(maskedContent)
	maskedContent = maskedContent.replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, match =>
		' '.repeat(match.length)
	)

	const idRegex = /\b([a-zA-Z_$][\w$]*)\b/g
	let match: RegExpExecArray | null
	while ((match = idRegex.exec(maskedContent)) !== null) {
		const id = match[1]
		if (isJsReservedIdentifier(id)) continue

		const indexInContent = match.index
		const charBefore = indexInContent > 0 ? content[indexInContent - 1] : ''
		if (charBefore === '.') {
			const isSpread =
				indexInContent >= 3 && content.slice(indexInContent - 3, indexInContent) === '...'
			if (!isSpread) continue
		}

		const afterId = content.slice(indexInContent + id.length)
		if (/^\s*:\s*/.test(afterId)) {
			continue
		}

		const propertyPath: string[] = []
		const propertyRanges: vscode.Range[] = []

		let currentAfter = maskedContent.slice(indexInContent + id.length)
		let currentOffsetRel = indexInContent + id.length

		const propRegex = /^\s*\.\s*([a-zA-Z_$][\w$]*)/
		let propMatch
		while ((propMatch = propRegex.exec(currentAfter))) {
			const propName = propMatch[1]
			propertyPath.push(propName)

			const matchStartInAfter = propMatch.index
			const nameStartInMatch = propMatch[0].lastIndexOf(propName)
			const propAbsStart = startOffset + currentOffsetRel + matchStartInAfter + nameStartInMatch

			propertyRanges.push(
				new vscode.Range(
					document.positionAt(propAbsStart),
					document.positionAt(propAbsStart + propName.length)
				)
			)

			const matchLen = propMatch[0].length
			currentAfter = currentAfter.slice(matchLen)
			currentOffsetRel += matchLen
		}

		const absStart = startOffset + match.index
		const ref: TemplateReference = {
			content: id,
			range: new vscode.Range(
				document.positionAt(absStart),
				document.positionAt(absStart + id.length)
			),
			offset: absStart,
			isAttribute,
			isAlpine,
		}

		if (propertyPath.length > 0) {
			ref.propertyPath = propertyPath
			ref.propertyRanges = propertyRanges
		}

		refs.push(ref)
	}
}
