import { collectForDirectiveBindingNames, parseForDirective } from '@aero-js/compiler'
import * as vscode from 'vscode'
import type { TemplateScope } from './types'

export function collectTemplateScopes(
	document: vscode.TextDocument,
	text: string
): TemplateScope[] {
	type StackItem = {
		tagName: string
		forScope?: Omit<TemplateScope, 'endOffset'>
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
					if (open.forScope) {
						scopes.push({ ...open.forScope, endOffset: tagEnd })
					}
					break
				}
			}
			continue
		}

		const forScope = parseForAttribute(document, attrs, tagStart, fullTag)
		const selfClosing = /\/\s*>$/.test(fullTag)
		if (selfClosing) {
			if (forScope) {
				scopes.push({ ...forScope, startOffset: tagStart, endOffset: tagEnd })
			}
			continue
		}

		stack.push({
			tagName,
			forScope: forScope ? { ...forScope, startOffset: tagStart } : undefined,
		})
	}

	for (const open of stack) {
		if (open.forScope) {
			scopes.push({ ...open.forScope, endOffset: text.length })
		}
	}

	return scopes
}

function parseForAttribute(
	document: vscode.TextDocument,
	attrs: string,
	tagStart: number,
	fullTag: string
): Omit<TemplateScope, 'startOffset' | 'endOffset'> | null {
	const forAttr = /\b(?:data-)?for\s*=\s*(['"])(.*?)\1/i.exec(attrs)
	if (!forAttr) return null

	const rawValue = forAttr[2] || ''
	let exprContent = rawValue
	let exprContentOffset = 0

	const curlyMatch = /^\s*\{([\s\S]*)\}\s*$/.exec(rawValue)
	if (curlyMatch) {
		exprContent = curlyMatch[1]
		exprContentOffset = rawValue.indexOf(exprContent)
	}

	const inner = exprContent.trim()
	let bindingNames: string[]
	try {
		bindingNames = collectForDirectiveBindingNames(inner)
	} catch {
		return null
	}

	let sourceExpr: string
	try {
		sourceExpr = parseForDirective(inner).iterable.trim()
	} catch {
		return null
	}

	const sourceRoot = sourceExpr.split(/[.[]/)[0]

	const attrsOffsetInTag = fullTag.indexOf(attrs)
	const attrBase = tagStart + (attrsOffsetInTag >= 0 ? attrsOffsetInTag : 0)
	const valueOffsetInAttr = forAttr[0].indexOf(rawValue)
	const valueStart = attrBase + forAttr.index + valueOffsetInAttr

	const exprStartInValue = exprContentOffset + exprContent.indexOf(inner)
	const exprStart = valueStart + exprStartInValue

	const afterOf = /\s+of\s+/.exec(inner)
	const sourceInnerStart = afterOf ? exprStart + afterOf.index + afterOf[0].length : exprStart
	const rest = inner.slice(afterOf ? afterOf.index + afterOf[0].length : 0)
	const leadingPad = rest.length - rest.trimStart().length
	const sourceStart = sourceInnerStart + leadingPad
	const sourceEnd = sourceStart + sourceExpr.length

	return {
		bindingNames,
		sourceExpr,
		sourceRoot,
		sourceRange: new vscode.Range(document.positionAt(sourceStart), document.positionAt(sourceEnd)),
	}
}
