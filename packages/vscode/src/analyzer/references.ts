import * as vscode from 'vscode'
import { tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import { parseScriptBlocks } from '../script-tag'
import { isInsideHtmlComment, maskJsComments } from './helpers'
import type { TemplateReference } from './types'

const STANDALONE_ATTR_VARIABLE_REFS = new Set(['props', 'data-props'])

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

	let maskedText = text.replace(
		/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi,
		(match, tag, content) => {
			return match.replace(content, ' '.repeat(content.length))
		}
	)

	maskedText = maskedText.replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))

	const tagRegex = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)>/gi
	let tagMatch: RegExpExecArray | null

	while ((tagMatch = tagRegex.exec(maskedText)) !== null) {
		const tagName = tagMatch[1]
		if (tagName === 'script' || tagName === 'style') continue

		if (tagName.endsWith('-component') || tagName.endsWith('-layout')) {
			const suffix = tagName.endsWith('-component') ? '-component' : '-layout'
			const prefix = tagName.slice(0, -suffix.length)
			const camelPrefix = prefix.replace(/-([a-z])/g, g => g[1].toUpperCase())

			refs.push({
				content: camelPrefix,
				range: new vscode.Range(
					document.positionAt(tagMatch.index + 1),
					document.positionAt(tagMatch.index + 1 + prefix.length)
				),
				offset: tagMatch.index + 1,
				isAttribute: false,
				isComponent: true,
			})
		}

		const attrsContent = tagMatch[2]
		const tagStart = tagMatch.index
		const attrsStart = tagStart + tagMatch[0].indexOf(attrsContent)

		const maskRange = (start: number, length: number) => {
			maskedText =
				maskedText.substring(0, start) + ' '.repeat(length) + maskedText.substring(start + length)
		}

		const attrRegex = /(?:\s|^)([a-zA-Z0-9-:@.]+)(?:(\s*=\s*)(['"])([\s\S]*?)\3)?/gi
		let attrMatch: RegExpExecArray | null

		while ((attrMatch = attrRegex.exec(attrsContent)) !== null) {
			const fullMatch = attrMatch[0]
			const name = attrMatch[1]
			const hasValue = !!attrMatch[3]
			const value = attrMatch[4] || ''

			const matchStartInAttrs = attrMatch.index
			const nameStartInMatch = fullMatch.indexOf(name)
			const absNameStart = attrsStart + matchStartInAttrs + nameStartInMatch

			const isAlpine = name.startsWith(':') || name.startsWith('@') || name.startsWith('x-')

			if (hasValue) {
				const quote = attrMatch[3]
				const quoteIndex = fullMatch.indexOf(quote, nameStartInMatch + name.length)
				const absValueStart = attrsStart + matchStartInAttrs + quoteIndex + 1

				if (isAlpine) {
					extractIdentifiers(value, absValueStart, document, refs, true, true)
					maskRange(absValueStart, value.length)
				} else {
					const segments = tokenizeCurlyInterpolation(value, {
						attributeMode: true,
					})
					for (const seg of segments) {
						if (seg.kind === 'interpolation') {
							const contentStart = absValueStart + seg.start + 1
							extractIdentifiers(seg.expression, contentStart, document, refs, true)
						}
					}
					maskRange(absValueStart, value.length)
				}
			} else {
				if (STANDALONE_ATTR_VARIABLE_REFS.has(name)) {
					refs.push({
						content: 'props',
						range: new vscode.Range(
							document.positionAt(absNameStart),
							document.positionAt(absNameStart + name.length)
						),
						offset: absNameStart,
						isAttribute: true,
					})
				}
			}
		}
	}

	const contentSegments = tokenizeCurlyInterpolation(maskedText, {
		attributeMode: false,
	})
	for (const seg of contentSegments) {
		if (seg.kind === 'interpolation') {
			const contentStart = seg.start + 1
			extractIdentifiers(seg.expression, contentStart, document, refs, false)
		}
	}

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
	const maskedContent = content.replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, match =>
		' '.repeat(match.length)
	)

	const idRegex = /\b([a-zA-Z_$][\w$]*)\b/g
	let match: RegExpExecArray | null
	while ((match = idRegex.exec(maskedContent)) !== null) {
		const id = match[1]
		if (
			/^(if|else|return|function|var|let|const|import|from|as|in|of|true|false|null|undefined)$/.test(
				id
			)
		)
			continue

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
