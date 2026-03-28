/**
 * Parse element and component DOM attributes for the lowerer (each, props, interpolation).
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import { isDirectiveAttr } from '../directive-attributes'
import { Resolver } from '../resolver'
import { CompileError } from '../types'
import type { LowererDiag, ParsedComponentAttrs, ParsedElementAttrs } from './types'

function lineColumnAtOffset(source: string, offset: number): { line: number; column: number } {
	const o = Math.max(0, Math.min(offset, source.length))
	let line = 1
	let lineStart = 0
	for (let i = 0; i < o; i++) {
		if (source.charCodeAt(i) === 10) {
			line++
			lineStart = i + 1
		}
	}
	return { line, column: o - lineStart }
}

export function isSingleWrappedExpression(value: string): boolean {
	const trimmed = value.trim()
	if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
	if (trimmed.startsWith('{{') || trimmed.endsWith('}}')) return false

	let depth = 0
	for (let i = 0; i < trimmed.length; i++) {
		const char = trimmed[i]
		if (char === '{') depth++
		if (char === '}') {
			depth--
			if (depth < 0) return false
			if (depth === 0 && i !== trimmed.length - 1) {
				return false
			}
		}
	}

	return depth === 0
}

/** Parses component attributes, extracting props and data-props */
export function parseComponentAttributes(node: any, diag: LowererDiag): ParsedComponentAttrs {
	const propsEntries: string[] = []
	let dataPropsExpression: string | null = null

	if (node.attributes) {
		for (let i = 0; i < node.attributes.length; i++) {
			const attr = node.attributes[i]
			if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) continue
			if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) continue
			if (Helper.isAttr(attr.name, CONST.ATTR_ELSE_IF, CONST.ATTR_PREFIX)) continue
			if (Helper.isAttr(attr.name, CONST.ATTR_ELSE, CONST.ATTR_PREFIX)) continue

			if (Helper.isAttr(attr.name, CONST.ATTR_PROPS, CONST.ATTR_PREFIX)) {
				const value = attr.value?.trim() || ''
				if (!value) {
					dataPropsExpression = '...props'
				} else {
					const tagName = node?.tagName?.toLowerCase?.() || 'element'
					const needle = `${attr.name}="${value}"`
					dataPropsExpression = Helper.stripBraces(
						Helper.validateSingleBracedExpression(value, {
							directive: attr.name,
							tagName,
							diagnosticSource: diag?.source,
							diagnosticFile: diag?.file,
							positionNeedle: diag ? needle : undefined,
						})
					)
				}
				continue
			}

			const rawValue = attr.value ?? ''
			const escapedLiteral = Helper.escapeBackticks(rawValue)
			let propVal: string

			if (isSingleWrappedExpression(rawValue)) {
				propVal = Helper.stripBraces(escapedLiteral)
			} else {
				const compiled = Helper.compileAttributeInterpolation(rawValue)
				const hasInterpolation =
					compiled.includes('${') || rawValue.includes('{{') || rawValue.includes('}}')
				propVal = hasInterpolation ? `\`${compiled}\`` : `"${escapedLiteral}"`
			}

			propsEntries.push(`${attr.name}: ${propVal}`)
		}
	}

	const propsString = Helper.buildPropsString(propsEntries, dataPropsExpression)
	return { propsString }
}

/** Parses element attributes, extracting data-each and building the attribute string */
export function parseElementAttributes(
	resolver: Resolver,
	diag: LowererDiag,
	node: any
): ParsedElementAttrs {
	const attributes: string[] = []
	let loopData: { item: string; index?: string; items: string } | null = null
	let passDataExpr: string | null = null

	if (node.attributes) {
		for (let i = 0; i < node.attributes.length; i++) {
			const attr = node.attributes[i]
			if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) {
				const tagName = node?.tagName?.toLowerCase?.() || 'element'
				const needle = `${attr.name}="${attr.value ?? ''}"`
				const content = Helper.stripBraces(
					Helper.validateSingleBracedExpression(attr.value || '', {
						directive: attr.name,
						tagName,
						diagnosticSource: diag?.source,
						diagnosticFile: diag?.file,
						positionNeedle: diag ? needle : undefined,
					})
				)
				const match = content.match(CONST.EACH_REGEX)
				if (!match) {
					const tagNameInner = node?.tagName?.toLowerCase?.() || 'element'
					const msg = `Directive \`${attr.name}\` on <${tagNameInner}> must match "{ item in items }" or "{ item, index in items }".`
					if (diag?.source && needle.length > 0) {
						const idx = diag.source.indexOf(needle)
						if (idx >= 0) {
							const { line, column } = lineColumnAtOffset(diag.source, idx)
							throw new CompileError({
								message: msg,
								file: diag.file,
								line,
								column,
							})
						}
					}
					if (diag?.file) {
						throw new CompileError({ message: msg, file: diag.file })
					}
					throw new Error(msg)
				}
				loopData = { item: match[1], index: match[2], items: match[3] }
				continue
			}

			if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) continue
			if (Helper.isAttr(attr.name, CONST.ATTR_ELSE_IF, CONST.ATTR_PREFIX)) continue
			if (Helper.isAttr(attr.name, CONST.ATTR_ELSE, CONST.ATTR_PREFIX)) continue

			if (Helper.isAttr(attr.name, CONST.ATTR_PROPS, CONST.ATTR_PREFIX)) {
				const value = attr.value?.trim() || ''
				passDataExpr = value
					? Helper.validateSingleBracedExpression(value, {
							directive: attr.name,
							tagName: node?.tagName?.toLowerCase?.() || 'element',
							diagnosticSource: diag?.source,
							diagnosticFile: diag?.file,
							positionNeedle: diag ? `${attr.name}="${value}"` : undefined,
						})
					: '{ ...props }'
				continue
			}

			if (attr.name === CONST.ATTR_IS_INLINE) {
				continue
			}

			let val = resolver.resolveAttrValue(attr.value ?? '')

			if (!isDirectiveAttr(attr.name)) {
				val = Helper.compileAttributeInterpolation(val)
			}
			attributes.push(`${attr.name}="${val}"`)
		}
	}

	const attrString = attributes.length ? ' ' + attributes.join(' ') : ''
	return { attrString, loopData, passDataExpr }
}
