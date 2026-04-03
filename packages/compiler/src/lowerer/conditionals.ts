/**
 * data-if / data-else-if / data-else chain detection and lowering to a single IR `If` node.
 *
 * @remarks
 * Branch bodies are compiled via `deps.compileElement` today. For `<template>` branches, the
 * intended API is `Lowerer.compileWrapperAwareBranch` (see `lowerer/template.ts`) once integrated.
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import type { IRNode } from '../ir'
import type { LowererDiag } from './types'

export function hasIfAttr(node: any): boolean {
	return (
		node.nodeType === 1 &&
		(node.hasAttribute(CONST.ATTR_IF) || node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_IF))
	)
}

export function hasElseIfAttr(node: any): boolean {
	return (
		node.nodeType === 1 &&
		(node.hasAttribute(CONST.ATTR_ELSE_IF) ||
			node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_ELSE_IF))
	)
}

export function hasElseAttr(node: any): boolean {
	return (
		node.nodeType === 1 &&
		(node.hasAttribute(CONST.ATTR_ELSE) || node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_ELSE))
	)
}

/** Gets the condition value from if/else-if attribute */
export function getCondition(node: any, attr: string, diag: LowererDiag): string | null {
	const tagName = node?.tagName?.toLowerCase?.() || 'element'
	const plainValue = node.getAttribute(attr)
	if (plainValue !== null) {
		const needle = `${attr}="${plainValue}"`
		return Helper.stripBraces(
			Helper.validateSingleBracedExpression(plainValue, {
				directive: attr,
				tagName,
				diagnosticSource: diag?.source,
				diagnosticFile: diag?.file,
				positionNeedle: diag ? needle : undefined,
			})
		)
	}

	const dataAttr = CONST.ATTR_PREFIX + attr
	const dataValue = node.getAttribute(dataAttr)
	if (dataValue !== null) {
		const needle = `${dataAttr}="${dataValue}"`
		return Helper.stripBraces(
			Helper.validateSingleBracedExpression(dataValue, {
				directive: dataAttr,
				tagName,
				diagnosticSource: diag?.source,
				diagnosticFile: diag?.file,
				positionNeedle: diag ? needle : undefined,
			})
		)
	}

	return null
}

export interface ConditionalChainDeps {
	compileElement(node: any, skipInterpolation: boolean, outVar: string): IRNode[]
}

/**
 * Lowers a conditional chain (if/else-if/else siblings) into one IR If node.
 * Returns the IR and how many DOM nodes were consumed.
 */
export function compileConditionalChain(
	deps: ConditionalChainDeps,
	diag: LowererDiag,
	nodes: NodeList,
	startIndex: number,
	skipInterpolation: boolean,
	outVar: string
): { nodes: IRNode[]; consumed: number } {
	let i = startIndex
	let condition: string | null = null
	let body: IRNode[] = []
	const elseIf: { condition: string; body: IRNode[] }[] = []
	let elseBody: IRNode[] | undefined

	while (i < nodes.length) {
		const node = nodes[i] as any
		if (!node || node.nodeType !== 1) {
			if (node?.nodeType === 3 && node.textContent?.trim() === '') {
				i++
				continue
			}
			break
		}

		if (condition === null) {
			if (!hasIfAttr(node)) break
			condition = getCondition(node, CONST.ATTR_IF, diag)!
			body = deps.compileElement(node, skipInterpolation, outVar)
			i++
		} else if (hasElseIfAttr(node)) {
			const elseIfCondition = getCondition(node, CONST.ATTR_ELSE_IF, diag)!
			elseIf.push({
				condition: elseIfCondition,
				body: deps.compileElement(node, skipInterpolation, outVar),
			})
			i++
		} else if (hasElseAttr(node)) {
			elseBody = deps.compileElement(node, skipInterpolation, outVar)
			i++
			break
		} else {
			break
		}
	}

	const ifNode: IRNode = {
		kind: 'If',
		condition: condition!,
		body,
		...(elseIf.length > 0 && { elseIf }),
		...(elseBody && elseBody.length > 0 && { else: elseBody }),
	}
	return { nodes: [ifNode], consumed: i - startIndex }
}
