/**
 * Parse element and component DOM attributes for the lowerer (for, props, interpolation).
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import {
	getBuildDirectiveAttribute,
	hasBuildDirectiveAttribute,
	isNativeBareAttribute,
	resolveBuildDirectiveName,
	type BuildDirective,
} from '../build-directive-attributes'
import { isDirectiveAttr } from '../directive-attributes'
import { parentIsSwitchContainer } from './switch'
import { Resolver } from '../resolver'
import { CompileError } from '../types'
import { tokenizeCurlyInterpolation } from '../tokenizer'
import { parseForDirective, findForLoopImplicitNameShadows, type ParsedForDirective } from '../for-directive'
import { parseEventDirectiveName } from '../event-directive-attributes'
import { normalizeRuntimeDirectiveName } from '../runtime-directive-attributes'
import {
	deriveHypermediaFallbackAttrs,
	renderFallbackAttributeString,
} from '../hypermedia-fallback'
import type { IRReactiveBusyBind, IRReactiveEventBind, IRReactiveTextBind } from '../ir'
import type { LowererDiag, LowererReactiveState, ParsedComponentAttrs, ParsedElementAttrs } from './types'

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

function hasDirectiveAttr(node: NodeLike, directiveName: BuildDirective): boolean {
	return hasBuildDirectiveAttribute(node, directiveName)
}

function isDirectiveAttrName(attrName: string, directives: readonly BuildDirective[]): boolean {
	const resolved = resolveBuildDirectiveName(attrName)
	return resolved != null && directives.includes(resolved)
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
	if (resolveBuildDirectiveName(attr.name) !== CONST.ATTR_FOR) return null
	// Bare `for` on <label>/<output> with a non-braced value is the native HTML attribute.
	if (isNativeBareAttribute(getTagName(node), attr.name, attr.value ?? null)) {
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
	const parsedEvent = parseEventDirectiveName(attr.name)
	if (parsedEvent.kind === 'ok') {
		const val = resolver.resolveAttrValue(attr.value ?? '')
		return `${parsedEvent.directive.canonicalName}="${val}"`
	}
	if (attr.name === CONST.ATTR_IS_INLINE) return null
	let val = resolver.resolveAttrValue(attr.value ?? '')
	if (!isDirectiveAttr(attr.name)) {
		val = Helper.compileAttributeInterpolation(val)
	}
	return `${attr.name}="${val}"`
}

function throwDirectiveError(
	node: NodeLike,
	diag: LowererDiag,
	attrName: string,
	attrValue: string | null | undefined,
	message: string
): never {
	const raw = attrValue ?? ''
	const needle = `${attrName}="${raw}"`
	if (diag?.source && needle.length > 0) {
		const idx = diag.source.indexOf(needle)
		if (idx >= 0) {
			const { line, column } = Helper.lineColumnAtOffset(diag.source, idx)
			throw new CompileError({ message, file: diag.file, line, column })
		}
	}
	if (diag?.file) {
		throw new CompileError({ message, file: diag.file })
	}
	throw new Error(message)
}

function validateEventDirective(node: NodeLike, diag: LowererDiag, attr: AttrLike): void {
	const parsed = parseEventDirectiveName(attr.name)
	if (parsed.kind === 'non-event') return
	if (parsed.kind === 'invalid') {
		throwDirectiveError(
			node,
			diag,
			attr.name,
			attr.value,
			`Directive \`${attr.name}\` on <${getTagName(node)}> is invalid: ${parsed.message}`
		)
	}
	validateBracedDirectiveValue(node, diag, attr.name, attr.value || '')
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

		if (resolveBuildDirectiveName(attr.name) === CONST.ATTR_PROPS) {
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

		if (attr.name.endsWith(':readonly')) {
			throwDirectiveError(
				node,
				diag,
				attr.name,
				attr.value,
				`Component live prop \`${attr.name}\` is obsolete; use \`${attr.name.slice(0, -':readonly'.length)}="{ ... }"\` because live props are readonly by default.`
			)
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

		const propName = attr.name.startsWith('bind:') ? attr.name.slice('bind:'.length) : attr.name
		propsEntries.push(`${JSON.stringify(propName)}: ${propVal}`)
	})

	const propsString = Helper.buildPropsString(propsEntries, dataPropsExpression)
	return { propsString }
}

/** Parses element attributes, extracting data-for and building the attribute string */
export function parseElementAttributes(
	resolver: Resolver,
	diag: LowererDiag,
	node: NodeLike,
	reactiveState?: LowererReactiveState,
	hypermedia?: boolean
): ParsedElementAttrs {
	const attributes: string[] = []
	const eventBinds: IRReactiveEventBind[] = []
	const textBinds: IRReactiveTextBind[] = []
	const busyBinds: IRReactiveBusyBind[] = []
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
				attr.value ?? null
			)
			if (parentIsSwitchContainer(node) || !nativeTrackDefault) return
		} else if (resolveBuildDirectiveName(attr.name) === CONST.ATTR_SWITCH) {
			// Bare boolean `switch` on <input> is the native attribute; pass it through.
			const tagName = getTagName(node)
			if (!isNativeBareAttribute(tagName, attr.name, attr.value ?? null)) {
				switchExpr = Helper.stripBraces(
					validateBracedDirectiveValue(node, diag, attr.name, attr.value || '')
				)
				return
			}
		}

		if (resolveBuildDirectiveName(attr.name) === CONST.ATTR_PROPS) {
			const value = attr.value?.trim() || ''
			passDataExpr = value
				? validateBracedDirectiveValue(node, diag, attr.name, value)
				: '{ ...props }'
			return
		}

		validateEventDirective(node, diag, attr)
		const parsedEvent = parseEventDirectiveName(attr.name)
		if (parsedEvent.kind === 'ok' && reactiveState) {
			const handlerExpr = Helper.stripBraces(
				validateBracedDirectiveValue(node, diag, attr.name, attr.value || '')
			)
			const bindId = reactiveState.nextEventBindId()
			eventBinds.push({
				kind: 'ReactiveEventBind',
				bindId,
				event: parsedEvent.directive.event,
				modifiers: parsedEvent.directive.modifiers,
				handlerExpr,
			})
			attributes.push(`data-aero-event="${bindId}"`)
			if (hypermedia) {
				const fallback = deriveHypermediaFallbackAttrs(getTagName(node), {
					kind: 'ReactiveEventBind',
					bindId,
					event: parsedEvent.directive.event,
					modifiers: parsedEvent.directive.modifiers,
					handlerExpr,
				})
				if (fallback) {
					const fallbackStr = renderFallbackAttributeString(fallback)
					if (fallbackStr.trim()) attributes.push(fallbackStr.trim())
				}
			}
			return
		}

		const parsedRuntime = normalizeRuntimeDirectiveName(attr.name)
		if (parsedRuntime?.canonicalBareName === 'text' && reactiveState) {
			const text = attr.value || ''
			const readExpr = Helper.compileReactiveTextReadExpr(text)
			const bindId = reactiveState.nextTextBindId()
			textBinds.push({
				kind: 'ReactiveTextBind',
				bindId,
				readExpr,
			})
			attributes.push(`data-aero-text="${bindId}"`)
			return
		}

		if (parsedRuntime?.canonicalBareName === 'busy' && reactiveState) {
			const readExpr = Helper.stripBraces(
				validateBracedDirectiveValue(node, diag, attr.name, attr.value || '')
			)
			const bindId = reactiveState.nextBusyBindId()
			busyBinds.push({
				kind: 'ReactiveBusyBind',
				bindId,
				readExpr,
			})
			attributes.push(`data-aero-busy="${bindId}"`)
			return
		}

		const emitted = buildEmittedAttribute(resolver, attr)
		if (!emitted) return
		attributes.push(emitted)
	})

	const attrString = attributes.length ? ' ' + attributes.join(' ') : ''
	return { attrString, loopData, switchExpr, passDataExpr, eventBinds, textBinds, busyBinds }
}
