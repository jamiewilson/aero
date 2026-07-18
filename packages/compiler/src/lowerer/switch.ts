/**
 * `switch` / `case` / `default` container lowering to {@link IRSwitch}.
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import {
	getBuildDirectiveAttribute,
	hasBuildDirectiveAttribute,
} from '../build-directive-attributes'
import type { IRSwitch, IRNode } from '../ir'
import { referencesStateBindingExpression } from '../state-mount-codegen'
import { CompileError } from '../types'
import type { LowererDiag } from './types'
import { getEffectiveChildNodes, isTemplateElement } from './template'

const SWITCH_NEEDLES = [
	'switch="',
	"switch='",
	'aero-switch=',
	'data-switch=',
	'switch={',
] as const

function throwSwitchError(diag: LowererDiag, message: string, needles: readonly string[]): never {
	const loc = Helper.locateInTemplateSource(diag?.source, {
		needles,
		maskEmbedded: true,
	})
	if (diag?.file || loc) {
		throw new CompileError({ message, file: diag?.file, ...loc })
	}
	throw new Error(message)
}

export function hasSwitchAttr(node: any): boolean {
	return node?.nodeType === 1 && hasBuildDirectiveAttribute(node, CONST.ATTR_SWITCH)
}

export function hasCaseAttr(node: any): boolean {
	return node?.nodeType === 1 && hasBuildDirectiveAttribute(node, CONST.ATTR_CASE)
}

export function hasDefaultAttr(node: any): boolean {
	return node?.nodeType === 1 && hasBuildDirectiveAttribute(node, CONST.ATTR_DEFAULT)
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
 * Parse `case="…"` / `aero-case="…"` into JS RHS comparand expression strings for `===`.
 */
export function parseCaseComparands(node: any, diag: LowererDiag): string[] {
	const tagName = node?.tagName?.toLowerCase?.() || 'element'
	const attr = getBuildDirectiveAttribute(node, CONST.ATTR_CASE)
	if (!attr) {
		throwSwitchError(
			diag,
			`Directive \`case\` on <${tagName}> requires a value (literal or braced expression).`,
			['case=', 'aero-case=', 'data-case=', ...SWITCH_NEEDLES]
		)
	}
	const raw = attr.value ?? ''
	const attrLabel = attr.name

	if (raw === null || raw === '') {
		throwSwitchError(
			diag,
			`Directive \`${attrLabel}\` on <${tagName}> requires a value (literal or braced expression).`,
			[`${attrLabel}=`, ...SWITCH_NEEDLES]
		)
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
				throwSwitchError(
					diag,
					`Grouped \`${attrLabel}\` must be a non-empty array literal, e.g. { ['a', 'b'] }.`,
					[`${attrLabel}="${raw}"`, `${attrLabel}=`, ...SWITCH_NEEDLES]
				)
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
	const seenComparands = new Set<string>()

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
			throwSwitchError(
				diag,
				'A `switch` container may only contain `case` / `default` branch elements, whitespace, and comments.',
				[...SWITCH_NEEDLES]
			)
		}

		if (seenDefault) {
			throwSwitchError(
				diag,
				'In a `switch`, `default` must be last; remove branches after `default`.',
				['default', 'aero-default', ...SWITCH_NEEDLES]
			)
		}

		const hasCase = hasCaseAttr(n)
		const hasDef = hasDefaultAttr(n)
		if (hasCase && hasDef) {
			throwSwitchError(
				diag,
				'A branch cannot have both `case` and `default`.',
				['case=', 'default', ...SWITCH_NEEDLES]
			)
		}

		if (hasDef) {
			seenDefault = true
			defaultBody = deps.compileBranchBody(n, skipInterpolation, outVar)
			i++
			continue
		}

		if (hasCase) {
			const comparandExprs = parseCaseComparands(n, diag)
			for (const expr of comparandExprs) {
				if (seenComparands.has(expr)) {
					diag?.onWarning?.({
						code: 'AERO_SWITCH',
						message: `Duplicate switch case value \`${expr}\`; only the first matching branch can run.`,
					})
				} else {
					seenComparands.add(expr)
				}
			}
			const body = deps.compileBranchBody(n, skipInterpolation, outVar)
			cases.push({ comparandExprs, body })
			i++
			continue
		}

		throwSwitchError(
			diag,
			'A `switch` container may only contain `case` / `default` branch elements (direct children).',
			[...SWITCH_NEEDLES]
		)
	}

	if (cases.length === 0 && !seenDefault) {
		throwSwitchError(
			diag,
			'`switch` requires at least one `case` or `default` branch.',
			[...SWITCH_NEEDLES]
		)
	}

	if (!seenDefault) {
		diag?.onWarning?.({
			code: 'AERO_SWITCH',
			message:
				'Switch has no `default` branch; unmatched values render no switch-controlled content.',
		})
	}

	return {
		kind: 'Switch',
		expression,
		cases,
		...(seenDefault ? { defaultBody } : {}),
	}
}

/** True when discriminant or any case comparand references reactive state bindings. */
export function isReactiveSwitch(
	expression: string,
	cases: readonly { comparandExprs: readonly string[] }[],
	bindingNames: ReadonlySet<string>
): boolean {
	if (referencesStateBindingExpression(expression, bindingNames)) return true
	for (const branch of cases) {
		for (const comparand of branch.comparandExprs) {
			if (referencesStateBindingExpression(comparand, bindingNames)) return true
		}
	}
	return false
}
