/**
 * `switch` / `case` / `default` container lowering to {@link IRSwitch}.
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import type { IRSwitch, IRNode } from '../ir'
import { CompileError } from '../types'
import type { LowererDiag } from './types'
import { getEffectiveChildNodes, isTemplateElement } from './template'

export function hasSwitchAttr(node: any): boolean {
	return (
		node?.nodeType === 1 &&
		(node.hasAttribute(CONST.ATTR_SWITCH) || node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_SWITCH))
	)
}

export function hasCaseAttr(node: any): boolean {
	return (
		node?.nodeType === 1 &&
		(node.hasAttribute(CONST.ATTR_CASE) || node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_CASE))
	)
}

export function hasDefaultAttr(node: any): boolean {
	return (
		node?.nodeType === 1 &&
		(node.hasAttribute(CONST.ATTR_DEFAULT) || node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_DEFAULT))
	)
}

/** Whether `node` is a direct child of an element (or template content fragment) that has `switch`. */
export function parentIsSwitchContainer(node: any): boolean {
	const p = node?.parentNode
	if (!p) return false
	if (p.nodeType === 1) {
		return hasSwitchAttr(p)
	}
	if (p.nodeType === 11) {
		const doc = node.ownerDocument ?? node.getRootNode?.()
		const templates = doc?.querySelectorAll?.('template')
		if (!templates) return false
		for (let i = 0; i < templates.length; i++) {
			const t = templates[i] as HTMLTemplateElement
			if (t.content === p && hasSwitchAttr(t)) return true
		}
	}
	return false
}

function splitTopLevelCommaSegments(inner: string): string[] {
	const t = inner.trim()
	if (!t.startsWith('[') || !t.endsWith(']')) return []
	const body = t.slice(1, -1).trim()
	if (!body) return []
	const parts: string[] = []
	let depth = 0
	let start = 0
	for (let i = 0; i < body.length; i++) {
		const ch = body[i]
		if (ch === '[' || ch === '(' || ch === '{') depth++
		else if (ch === ']' || ch === ')' || ch === '}') depth--
		else if (ch === ',' && depth === 0) {
			parts.push(body.slice(start, i).trim())
			start = i + 1
		}
	}
	parts.push(body.slice(start).trim())
	return parts.filter(Boolean)
}

/**
 * Parse `case="…"` / `data-case="…"` into JS RHS comparand expression strings for `===`.
 */
export function parseCaseComparands(node: any, diag: LowererDiag): string[] {
	const tagName = node?.tagName?.toLowerCase?.() || 'element'
	const plain = node.getAttribute(CONST.ATTR_CASE)
	const dataName = CONST.ATTR_PREFIX + CONST.ATTR_CASE
	const dataVal = node.getAttribute(dataName)
	const useData = plain === null && dataVal !== null
	const raw = useData ? dataVal! : plain ?? ''
	const attrLabel = useData ? dataName : CONST.ATTR_CASE

	if (raw === null || raw === '') {
		throw new CompileError({
			message: `Directive \`${attrLabel}\` on <${tagName}> requires a value (literal or braced expression).`,
			file: diag?.file,
		})
	}

	const trimmed = raw.trim()
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		const needle = `${attrLabel}="${raw}"`
		const inner = Helper.stripBraces(
			Helper.validateSingleBracedExpression(raw, {
				directive: attrLabel,
				tagName,
				diagnosticSource: diag?.source,
				diagnosticFile: diag?.file,
				positionNeedle: diag ? needle : undefined,
			})
		).trim()

		if (inner.startsWith('[') && inner.endsWith(']')) {
			const segments = splitTopLevelCommaSegments(inner)
			if (segments.length === 0) {
				throw new CompileError({
					message: `Grouped \`${attrLabel}\` must be a non-empty array literal, e.g. { ['a', 'b'] }.`,
					file: diag?.file,
				})
			}
			return segments
		}
		return [inner]
	}

	return [JSON.stringify(raw)]
}

export interface SwitchCompileDeps {
	compileBranchBody(node: any, skipInterpolation: boolean, outVar: string): IRNode[]
}

/**
 * Lower a `switch` container's direct children to a single {@link IRSwitch} node.
 */
export function compileSwitchContainer(
	deps: SwitchCompileDeps,
	diag: LowererDiag,
	container: any,
	expression: string,
	skipInterpolation: boolean,
	outVar: string
): IRSwitch {
	const childList = isTemplateElement(container)
		? getEffectiveChildNodes(container)
		: container.childNodes

	const cases: { comparandExprs: string[]; body: IRNode[] }[] = []
	let defaultBody: IRNode[] | undefined
	let seenDefault = false

	if (!childList) {
		return { kind: 'Switch', expression, cases: [], defaultBody: undefined }
	}

	let i = 0
	while (i < childList.length) {
		const n = childList[i] as any
		if (!n) break

		if (n.nodeType === 8) {
			i++
			continue
		}
		if (n.nodeType === 3 && n.textContent?.trim() === '') {
			i++
			continue
		}
		if (n.nodeType !== 1) {
			throw new CompileError({
				message:
					'A `switch` container may only contain `case` / `default` branch elements, whitespace, and comments.',
				file: diag?.file,
			})
		}

		if (seenDefault) {
			throw new CompileError({
				message: 'In a `switch`, `default` must be last; remove branches after `default`.',
				file: diag?.file,
			})
		}

		const hasCase = hasCaseAttr(n)
		const hasDef = hasDefaultAttr(n)
		if (hasCase && hasDef) {
			throw new CompileError({
				message: 'A branch cannot have both `case` and `default`.',
				file: diag?.file,
			})
		}

		if (hasDef) {
			seenDefault = true
			defaultBody = deps.compileBranchBody(n, skipInterpolation, outVar)
			i++
			continue
		}

		if (hasCase) {
			const comparandExprs = parseCaseComparands(n, diag)
			const body = deps.compileBranchBody(n, skipInterpolation, outVar)
			cases.push({ comparandExprs, body })
			i++
			continue
		}

		throw new CompileError({
			message:
				'A `switch` container may only contain `case` / `default` branch elements (direct children).',
			file: diag?.file,
		})
	}

	if (cases.length === 0 && !seenDefault) {
		throw new CompileError({
			message: '`switch` requires at least one `case` or `default` branch.',
			file: diag?.file,
		})
	}

	return {
		kind: 'Switch',
		expression,
		cases,
		...(seenDefault ? { defaultBody } : {}),
	}
}
