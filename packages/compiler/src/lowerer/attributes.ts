/**
 * Parse element and component DOM attributes for the lowerer (for, props, interpolation).
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import { isDirectiveAttr } from '../directive-attributes'
import { Resolver } from '../resolver'
import { CompileError } from '../types'
import { tokenizeCurlyInterpolation } from '../tokenizer'
import { parseForDirective, type ParsedForDirective } from '../for-directive'
import type { LowererDiag, ParsedComponentAttrs, ParsedElementAttrs } from './types'

type AttrLike = { name: string; value?: string | null }
type NodeLike = {
	nodeType?: number
	tagName?: string
	attributes?: ArrayLike<AttrLike>
	hasAttribute?: (name: string) => boolean
}

const TEMPLATE_DIRECTIVE_ATTRS = [
	CONST.ATTR_IF,
	CONST.ATTR_ELSE_IF,
	CONST.ATTR_ELSE,
	CONST.ATTR_FOR,
	CONST.ATTR_SWITCH,
] as const

const NON_PROP_COMPONENT_DIRECTIVE_ATTRS = [
	...TEMPLATE_DIRECTIVE_ATTRS,
	CONST.ATTR_CASE,
	CONST.ATTR_DEFAULT,
] as const

const NON_EMIT_ELEMENT_DIRECTIVE_ATTRS = [
	CONST.ATTR_IF,
	CONST.ATTR_ELSE_IF,
	CONST.ATTR_ELSE,
	CONST.ATTR_CASE,
	CONST.ATTR_DEFAULT,
] as const

function hasDirectiveAttr(node: NodeLike, directiveName: string): boolean {
	return Boolean(
		node?.hasAttribute?.(directiveName) || node?.hasAttribute?.(CONST.ATTR_PREFIX + directiveName)
	)
}

function isDirectiveAttrName(attrName: string, directives: readonly string[]): boolean {
	for (const directive of directives) {
		if (Helper.isAttr(attrName, directive, CONST.ATTR_PREFIX)) return true
	}
	return false
}

function getTagName(node: NodeLike): string {
	return node?.tagName?.toLowerCase?.() || 'element'
}

function forEachAttribute(node: NodeLike, visit: (attr: AttrLike) => void): void {
	const attrs = node?.attributes
	if (!attrs || attrs.length === 0) return
	for (let i = 0; i < attrs.length; i++) {
		visit(attrs[i])
	}
}

function validateBracedDirectiveValue(
	node: NodeLike,
	diag: LowererDiag,
	attrName: string,
	value: string
): string {
	return Helper.validateSingleBracedExpression(value, {
		directive: attrName,
		tagName: getTagName(node),
		diagnosticSource: diag?.source,
		diagnosticFile: diag?.file,
		positionNeedle: diag ? `${attrName}="${value}"` : undefined,
	})
}

function parseForAttribute(
	node: NodeLike,
	diag: LowererDiag,
	attr: AttrLike
): { binding: string; items: string } | null {
	if (!Helper.isAttr(attr.name, CONST.ATTR_FOR, CONST.ATTR_PREFIX)) return null
	const rawValue = attr.value || ''
	const content = Helper.stripBraces(validateBracedDirectiveValue(node, diag, attr.name, rawValue))
	let parsed: ParsedForDirective
	try {
		parsed = parseForDirective(content)
	} catch (e) {
		const msg =
			e instanceof Error
				? e.message
				: `Directive \`${attr.name}\` on <${getTagName(node)}> must be a valid for…of head: const … of …`
		const needle = `${attr.name}="${rawValue}"`
		if (diag?.source && needle.length > 0) {
			const idx = diag.source.indexOf(needle)
			if (idx >= 0) {
				const { line, column } = Helper.lineColumnAtOffset(diag.source, idx)
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
	return { binding: parsed.binding, items: parsed.iterable }
}

function buildEmittedAttribute(resolver: Resolver, attr: AttrLike): string | null {
	if (attr.name === CONST.ATTR_IS_INLINE) return null
	let val = resolver.resolveAttrValue(attr.value ?? '')
	if (!isDirectiveAttr(attr.name)) {
		val = Helper.compileAttributeInterpolation(val)
	}
	return `${attr.name}="${val}"`
}

export function warnWrapperlessTemplateAttributes(diag: LowererDiag, node: NodeLike): void {
	if (!diag?.onWarning) return
	if (node?.nodeType !== 1) return
	if (typeof node.tagName !== 'string' || getTagName(node) !== CONST.TAG_TEMPLATE) return
	if (!node.attributes || node.attributes.length === 0) return
	const isWrapperlessTemplate =
		hasDirectiveAttr(node, CONST.ATTR_IF) ||
		hasDirectiveAttr(node, CONST.ATTR_ELSE_IF) ||
		hasDirectiveAttr(node, CONST.ATTR_ELSE) ||
		hasDirectiveAttr(node, CONST.ATTR_FOR) ||
		hasDirectiveAttr(node, CONST.ATTR_SWITCH)
	if (!isWrapperlessTemplate) return

	const invalid: string[] = []
	forEachAttribute(node, attr => {
		if (!attr?.name) return
		if (isDirectiveAttrName(attr.name, TEMPLATE_DIRECTIVE_ATTRS)) return
		invalid.push(attr.name)
	})
	if (invalid.length === 0) return
	const unique = [...new Set(invalid)].sort()
	diag.onWarning({
		code: 'AERO_TEMPLATE',
		message:
			`Wrapperless <template> ignores non-directive attributes (${unique.join(', ')}). ` +
			'Move them to a real element inside the template block.',
	})
}

export function isSingleWrappedExpression(value: string): boolean {
	const trimmed = value.trim()
	if (!trimmed) return false
	const segments = tokenizeCurlyInterpolation(trimmed, { attributeMode: true })
	return (
		segments.length === 1 &&
		segments[0].kind === 'interpolation' &&
		segments[0].start === 0 &&
		segments[0].end === trimmed.length
	)
}

/** Parses component attributes, extracting props and data-props */
export function parseComponentAttributes(node: NodeLike, diag: LowererDiag): ParsedComponentAttrs {
	const propsEntries: string[] = []
	let dataPropsExpression: string | null = null

	forEachAttribute(node, attr => {
		if (isDirectiveAttrName(attr.name, NON_PROP_COMPONENT_DIRECTIVE_ATTRS)) return

		if (Helper.isAttr(attr.name, CONST.ATTR_PROPS, CONST.ATTR_PREFIX)) {
			const value = attr.value?.trim() || ''
			if (!value) {
				dataPropsExpression = '...props'
			} else {
				dataPropsExpression = Helper.stripBraces(
					validateBracedDirectiveValue(node, diag, attr.name, value)
				)
			}
			return
		}

		const rawValue = attr.value ?? ''
		let propVal: string

		if (isSingleWrappedExpression(rawValue)) {
			propVal = Helper.stripBraces(rawValue)
		} else {
			const compiled = Helper.compileAttributeInterpolation(rawValue)
			const hasInterpolation =
				compiled.includes('${') || rawValue.includes('{{') || rawValue.includes('}}')
			propVal = hasInterpolation ? `\`${compiled}\`` : JSON.stringify(rawValue)
		}

		propsEntries.push(`${JSON.stringify(attr.name)}: ${propVal}`)
	})

	const propsString = Helper.buildPropsString(propsEntries, dataPropsExpression)
	return { propsString }
}

/** Parses element attributes, extracting data-for and building the attribute string */
export function parseElementAttributes(
	resolver: Resolver,
	diag: LowererDiag,
	node: NodeLike
): ParsedElementAttrs {
	const attributes: string[] = []
	let loopData: { binding: string; items: string } | null = null
	let switchExpr: string | null = null
	let passDataExpr: string | null = null

	forEachAttribute(node, attr => {
		const parsedFor = parseForAttribute(node, diag, attr)
		if (parsedFor) {
			loopData = parsedFor
			return
		}

		if (isDirectiveAttrName(attr.name, NON_EMIT_ELEMENT_DIRECTIVE_ATTRS)) return

		if (Helper.isAttr(attr.name, CONST.ATTR_SWITCH, CONST.ATTR_PREFIX)) {
			switchExpr = Helper.stripBraces(
				validateBracedDirectiveValue(node, diag, attr.name, attr.value || '')
			)
			return
		}

		if (Helper.isAttr(attr.name, CONST.ATTR_PROPS, CONST.ATTR_PREFIX)) {
			const value = attr.value?.trim() || ''
			passDataExpr = value
				? validateBracedDirectiveValue(node, diag, attr.name, value)
				: '{ ...props }'
			return
		}

		const emitted = buildEmittedAttribute(resolver, attr)
		if (!emitted) return
		attributes.push(emitted)
	})

	const attrString = attributes.length ? ' ' + attributes.join(' ') : ''
	return { attrString, loopData, switchExpr, passDataExpr }
}
