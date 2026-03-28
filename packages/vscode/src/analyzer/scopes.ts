import { EACH_REGEX } from '@aero-js/compiler/constants'
import * as vscode from 'vscode'
import type { TemplateScope } from './types'

export function collectTemplateScopes(
	document: vscode.TextDocument,
	text: string
): TemplateScope[] {
	type StackItem = {
		tagName: string
		each?: Omit<TemplateScope, 'endOffset'>
	}

	const scopes: TemplateScope[] = []
	const stack: StackItem[] = []
	const tagRegex = /<\/?([a-z][a-z0-9-]*)\b([^>]*?)>/gi

	let match: RegExpExecArray | null
	while ((match = tagRegex.exec(text)) !== null) {
		const fullTag = match[0]
		const isClosing = fullTag.startsWith('</')
		const tagName = match[1]
		const attrs = match[2] || ''
		const tagStart = match.index
		const tagEnd = tagStart + fullTag.length

		if (isClosing) {
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i].tagName === tagName) {
					const open = stack.splice(i, 1)[0]
					if (open.each) {
						scopes.push({ ...open.each, endOffset: tagEnd })
					}
					break
				}
			}
			continue
		}

		const each = parseEachAttribute(document, attrs, tagStart, fullTag)
		const selfClosing = /\/\s*>$/.test(fullTag)
		if (selfClosing) {
			if (each) {
				scopes.push({ ...each, startOffset: tagStart, endOffset: tagEnd })
			}
			continue
		}

		stack.push({
			tagName,
			each: each ? { ...each, startOffset: tagStart } : undefined,
		})
	}

	for (const open of stack) {
		if (open.each) {
			scopes.push({ ...open.each, endOffset: text.length })
		}
	}

	return scopes
}

function parseEachAttribute(
	document: vscode.TextDocument,
	attrs: string,
	tagStart: number,
	fullTag: string
): Omit<TemplateScope, 'startOffset' | 'endOffset'> | null {
	const eachAttr = /\b(?:data-)?each\s*=\s*(['"])(.*?)\1/i.exec(attrs)
	if (!eachAttr) return null

	const rawValue = eachAttr[2] || ''
	let exprContent = rawValue
	let exprContentOffset = 0

	const curlyMatch = /^\s*\{([\s\S]*)\}\s*$/.exec(rawValue)
	if (curlyMatch) {
		exprContent = curlyMatch[1]
		exprContentOffset = rawValue.indexOf(exprContent)
	}

	const expr = exprContent.trim()
	const exprMatch = EACH_REGEX.exec(expr)
	if (!exprMatch) return null

	const itemName = exprMatch[1]
	const indexName = exprMatch[2] || undefined
	const sourceExpr = exprMatch[3].trim()
	const sourceRoot = sourceExpr.split(/[.\[]/)[0]

	const attrsOffsetInTag = fullTag.indexOf(attrs)
	const attrBase = tagStart + (attrsOffsetInTag >= 0 ? attrsOffsetInTag : 0)
	const valueOffsetInAttr = eachAttr[0].indexOf(rawValue)
	const valueStart = attrBase + eachAttr.index + valueOffsetInAttr

	const exprStartInValue = exprContentOffset + exprContent.indexOf(expr)
	const exprStart = valueStart + exprStartInValue

	const itemStart = exprStart + expr.indexOf(itemName)
	const itemEnd = itemStart + itemName.length

	const afterIn = /\s+in\s+/.exec(expr)
	const sourceInnerStart = afterIn ? exprStart + afterIn.index + afterIn[0].length : exprStart
	const trimmedFromInner = expr.slice(afterIn ? afterIn.index + afterIn[0].length : 0)
	const leadingPad = trimmedFromInner.length - trimmedFromInner.trimStart().length
	const sourceStart = sourceInnerStart + leadingPad
	const sourceEnd = sourceStart + sourceExpr.length

	let indexRange: vscode.Range | undefined
	if (indexName) {
		const commaIdx = expr.indexOf(',')
		const idxInExpr = commaIdx >= 0 ? expr.indexOf(indexName, commaIdx) : expr.indexOf(indexName)
		if (idxInExpr >= 0) {
			const idxStart = exprStart + idxInExpr
			const idxEnd = idxStart + indexName.length
			indexRange = new vscode.Range(document.positionAt(idxStart), document.positionAt(idxEnd))
		}
	}

	const result: Omit<TemplateScope, 'startOffset' | 'endOffset'> = {
		itemName,
		itemRange: new vscode.Range(document.positionAt(itemStart), document.positionAt(itemEnd)),
		sourceExpr,
		sourceRoot,
		sourceRange: new vscode.Range(document.positionAt(sourceStart), document.positionAt(sourceEnd)),
	}
	if (indexName) {
		result.indexName = indexName
		if (indexRange) result.indexRange = indexRange
	}
	return result
}
