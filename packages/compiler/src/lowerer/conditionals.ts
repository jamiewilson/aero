/**
 * if / else-if / else chain detection and lowering to a single IR `If` node.
 *
 * @remarks
 * Branch bodies use {@link ConditionalChainDeps.compileBranchBody}, which must compile
 * `<template>` branches without emitting the wrapper (see `Lowerer.compileWrapperAwareBranch`).
 */

import { ATTR_ELSE, ATTR_ELSE_IF, ATTR_IF } from '../constants'
import {
	getBuildDirectiveAttribute,
	hasBuildDirectiveAttribute,
	type BuildDirective,
} from '../build-directive-attributes'
import * as Helper from '../helpers'
import type { IRNode } from '../ir'
import type { LowererDiag } from './types'

export function hasIfAttr(node: any): boolean {
	return node.nodeType === 1 && hasBuildDirectiveAttribute(node, ATTR_IF)
}

export function hasElseIfAttr(node: any): boolean {
	return node.nodeType === 1 && hasBuildDirectiveAttribute(node, ATTR_ELSE_IF)
}

export function hasElseAttr(node: any): boolean {
	return node.nodeType === 1 && hasBuildDirectiveAttribute(node, ATTR_ELSE)
}

/** Gets the condition value from if/else-if attribute */
export function getCondition(node: any, directive: BuildDirective, diag: LowererDiag): string | null {
	const tagName = node?.tagName?.toLowerCase?.() || 'element'
	const attr = getBuildDirectiveAttribute(node, directive)
	if (!attr) return null
	const needle =
		attr.value != null && attr.value !== '' ? `${attr.name}="${attr.value}"` : undefined
	return Helper.stripBraces(
		Helper.validateSingleBracedExpression(attr.value ?? '', {
			directive: attr.name,
			tagName,
			diagnosticSource: diag?.source,
			diagnosticFile: diag?.file,
			positionNeedle: diag ? needle : undefined,
		})
	)
}

export interface ConditionalChainDeps {
	/** Wrapper-aware: `<template>` branches compile children only; other elements keep their tags. */
	compileBranchBody(node: any, skipInterpolation: boolean, outVar: string): IRNode[]
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
		if (!node) break

		// Ignorable separators between branches (whitespace text, comments)
		if (node.nodeType === 8) {
			i++
			continue
		}
		if (node.nodeType !== 1) {
			if (node.nodeType === 3 && node.textContent?.trim() === '') {
				i++
				continue
			}
			break
		}

		if (condition === null) {
			if (!hasIfAttr(node)) break
			condition = getCondition(node, ATTR_IF, diag)!
			body = deps.compileBranchBody(node, skipInterpolation, outVar)
			i++
		} else if (hasElseIfAttr(node)) {
			const elseIfCondition = getCondition(node, ATTR_ELSE_IF, diag)!
			elseIf.push({
				condition: elseIfCondition,
				body: deps.compileBranchBody(node, skipInterpolation, outVar),
			})
			i++
		} else if (hasElseAttr(node)) {
			elseBody = deps.compileBranchBody(node, skipInterpolation, outVar)
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
