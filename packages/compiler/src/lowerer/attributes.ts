/**
 * Parse element and component DOM attributes for the lowerer (for, props, interpolation).
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import { isDirectiveAttr } from '../directive-attributes'
import { parentIsSwitchContainer } from './switch'
import { Resolver } from '../resolver'
import { CompileError } from '../types'
import { tokenizeCurlyInterpolation } from '../tokenizer'
import { parseForDirective, findForLoopImplicitNameShadows, type ParsedForDirective } from '../for-directive'
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

/** A value is directive-shaped when it is a single brace-wrapped expression, e.g. `{ expr }`. */
function looksBraced(raw: string | null | undefined): boolean {
	if (!raw) return false
	const trimmed = raw.trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}')
}

/**
 * Elements on which a bare directive name is actually a real HTML attribute. A bare `for` is the
 * native attribute on `<label>`/`<output>`, `switch` on `<input>` (Safari toggle), `default` on
 * `<track>`. Anywhere else the bare name is an Aero directive (so a forgotten-brace loop like
 * `<li for="const x of xs">` still fails loud). The `data-` form is always an explicit directive.
 */
const NATIVE_ATTR_ELEMENTS: Record<string, ReadonlySet<string>> = {
	[CONST.ATTR_FOR]: new Set(['label', 'output']),
	[CONST.ATTR_SWITCH]: new Set(['input']),
	[CONST.ATTR_DEFAULT]: new Set(['track']),
}

/**
 * True when a bare (non-`data-`) directive-named attribute should be left as a native HTML
 * attribute: the name matches the directive, its value is not brace-shaped, and the tag is one
 * where that attribute is genuinely native.
 */
function isNativeBareAttribute(
	tagName: string,
	name: string,
	directive: string,
	value: string | null
): boolean {
	if (name !== directive || looksBraced(value)) return false
	return NATIVE_ATTR_ELEMENTS[directive]?.has(tagName) ?? false
}

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

function warnForLoopImplicitNameShadow(
	diag: LowererDiag,
	attr: AttrLike,
	inner: string
): void {
	if (!diag?.onWarning) return
	const shadowed = findForLoopImplicitNameShadows(inner)
	if (shadowed.length === 0) return
	const rawValue = attr.value || ''
	const needle = `${attr.name}="${rawValue}"`
	let line: number | undefined
	let column: number | undefined
	if (diag.source && needle.length > 0) {
		const idx = diag.source.indexOf(needle)
		if (idx >= 0) {
			const pos = Helper.lineColumnAtOffset(diag.source, idx)
			line = pos.line
			column = pos.column
		}
	}
	diag.onWarning({
		code: 'AERO_TEMPLATE',
		message:
			`for loop binding shadows built-in loop metadata (${shadowed.join(', ')}). ` +
			'Rename the binding to avoid shadowing index, first, last, or length.',
		...(line !== undefined && column !== undefined ? { line, column } : {}),
	})
}

function parseForAttribute(
	node: NodeLike,
	diag: LowererDiag,
	attr: AttrLike
): { binding: string; items: string } | null {
	if (!Helper.isAttr(attr.name, CONST.ATTR_FOR, CONST.ATTR_PREFIX)) return null
	// Bare `for` on <label>/<output> with a non-braced value is the native HTML attribute.
	if (isNativeBareAttribute(getTagName(node), attr.name, CONST.ATTR_FOR, attr.value ?? null)) {
		return null
	}
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
	warnForLoopImplicitNameShadow(diag, attr, content)
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

		// Conditional directives are never emitted; conditional lowering owns the element.
		if (isDirectiveAttrName(attr.name, [CONST.ATTR_IF, CONST.ATTR_ELSE_IF, CONST.ATTR_ELSE])) {
			return
		}

		// `case` / `default` are switch-branch markers consumed by switch lowering. Outside a switch
		// only a bare `default` on <track> survives (the native boolean); every other placement is a
		// misplaced branch that the lowerer's switch guard reports.
		if (isDirectiveAttrName(attr.name, [CONST.ATTR_CASE, CONST.ATTR_DEFAULT])) {
			const nativeTrackDefault = isNativeBareAttribute(
				getTagName(node),
				attr.name,
				CONST.ATTR_DEFAULT,
				attr.value ?? null
			)
			if (parentIsSwitchContainer(node) || !nativeTrackDefault) return
		} else if (Helper.isAttr(attr.name, CONST.ATTR_SWITCH, CONST.ATTR_PREFIX)) {
			// Bare boolean `switch` on <input> is the native attribute; pass it through.
			const tagName = getTagName(node)
			if (!isNativeBareAttribute(tagName, attr.name, CONST.ATTR_SWITCH, attr.value ?? null)) {
				switchExpr = Helper.stripBraces(
					validateBracedDirectiveValue(node, diag, attr.name, attr.value || '')
				)
				return
			}
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
