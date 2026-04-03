/**
 * Walks linkedom DOM and lowers to IR (elements, components, slots, for, if/else chains).
 *
 * @remarks
 * **`<template>`:** A plain `<template>` in source is still lowered through {@link compileElement},
 * which emits `<template>...</template>`. **Wrapperless** cases (no `<template>` in output,
 * children from `template.content`): `if` / `else-if` / `else` chains via
 * {@link compileWrapperAwareBranch}; `data-for` / `for` on `<template>` via
 * {@link compileWrapperlessNode} for the loop body.
 */

import type { IRNode } from '../ir'
import * as CONST from '../constants'
import * as Helper from '../helpers'
import { Resolver } from '../resolver'
import { parseElementAttributes, parseComponentAttributes } from './attributes'
import { compileConditionalChain, hasIfAttr } from './conditionals'
import { getEffectiveChildNodes, isTemplateElement } from './template'
import {
	compileSlot,
	compileSlotDefaultContent,
	compileElementDefaultContent,
	type SlotDefaultContentDeps,
} from './slots'
import type { LowererDiag } from './types'

/** Internal lowerer: walks DOM nodes and builds IR; used by compile(). */
export class Lowerer {
	private resolver: Resolver
	private slotCounter = 0
	private readonly diag: LowererDiag

	constructor(resolver: Resolver, diag?: { source: string; file?: string }) {
		this.resolver = resolver
		this.diag = diag
	}

	private get slotDeps(): SlotDefaultContentDeps {
		return {
			parseElementAttributes: (n: any) => parseElementAttributes(this.resolver, this.diag, n),
			parseComponentAttributes: (n: any) => parseComponentAttributes(n, this.diag),
		}
	}

	private compileSlotDefaultContent(
		nodes: NodeList | undefined,
		skipInterpolation: boolean
	): string {
		return compileSlotDefaultContent(nodes, skipInterpolation, this.slotDeps, (n, s) =>
			this.compileElementDefaultContent(n, s)
		)
	}

	private compileElementDefaultContent(node: any, skipInterpolation: boolean): string {
		return compileElementDefaultContent(node, skipInterpolation, this.slotDeps, (nodes, skip) =>
			this.compileSlotDefaultContent(nodes, skip)
		)
	}

	compileNode(node: any, skipInterpolation = false, outVar = '__out'): IRNode[] {
		switch (node.nodeType) {
			case 3:
				return this.compileText(node, skipInterpolation, outVar)
			case 1:
				return this.compileElement(node, skipInterpolation, outVar)
			default:
				return []
		}
	}

	compileFragment(nodes: NodeList | undefined): IRNode[] {
		return this.compileChildNodes(nodes, false, '__out')
	}

	/**
	 * Compiles `node`'s inner structure via {@link getEffectiveChildNodes} without emitting the
	 * node's outer tags. For `<template>`, inner markup comes from `template.content`, so output
	 * IR never includes `<template>` / `</template>`.
	 */
	compileWrapperlessNode(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const children = getEffectiveChildNodes(node)
		return this.compileChildNodes(children, skipInterpolation, outVar)
	}

	/**
	 * Compiles a branch body: {@link compileElement} for normal elements; for `<template>` only,
	 * {@link compileWrapperlessNode} so the tag is not present in the output. Used by conditional
	 * chains and intended for `switch` branches.
	 */
	compileWrapperAwareBranch(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		if (isTemplateElement(node)) {
			return this.compileWrapperlessNode(node, skipInterpolation, outVar)
		}
		return this.compileElement(node, skipInterpolation, outVar)
	}

	private compileChildNodes(
		nodes: NodeList | undefined,
		skipInterpolation: boolean,
		outVar: string
	): IRNode[] {
		if (!nodes) return []
		const out: IRNode[] = []
		let i = 0
		while (i < nodes.length) {
			const node = nodes[i]

			if (hasIfAttr(node)) {
				const { nodes: chainNodes, consumed } = compileConditionalChain(
					{
						compileBranchBody: (n, skip, o) => this.compileWrapperAwareBranch(n, skip, o),
					},
					this.diag,
					nodes,
					i,
					skipInterpolation,
					outVar
				)
				out.push(...chainNodes)
				i += consumed
				continue
			}

			out.push(...this.compileNode(node, skipInterpolation, outVar))
			i++
		}
		return out
	}

	private compileText(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const text = node.textContent || ''
		if (!text) return []
		const content = skipInterpolation
			? Helper.escapeBackticks(text)
			: Helper.compileInterpolation(text)
		return [{ kind: 'Append', content, outVar }]
	}

	/**
	 * Lower a single element node to IR (tags + children). Uses `node.childNodes` for children;
	 * for `<template>`, wrapperless APIs in `template.ts` should be used when the tag must not
	 * appear in output.
	 */
	private compileElement(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const tagName = node.tagName.toLowerCase()

		if (tagName === CONST.TAG_SLOT) {
			return compileSlot(node, skipInterpolation, outVar, (nodes, skip) =>
				this.compileSlotDefaultContent(nodes, skip)
			)
		}

		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponent(node, tagName, skipInterpolation, outVar)
		}

		const { attrString, loopData, passDataExpr } = parseElementAttributes(
			this.resolver,
			this.diag,
			node
		)
		const childSkip =
			skipInterpolation || tagName === 'style' || (tagName === 'script' && !passDataExpr)

		// Wrapperless `<template data-for>` / `<template for>`: body is template contents only.
		if (loopData && isTemplateElement(node)) {
			const inner = this.compileWrapperlessNode(node, childSkip, outVar)
			return [
				{
					kind: 'For',
					binding: loopData.binding,
					items: loopData.items,
					body: inner,
				},
			]
		}

		const inner: IRNode[] = []

		if (CONST.VOID_TAGS.has(tagName)) {
			inner.push({
				kind: 'Append',
				content: `<${tagName}${attrString}>`,
				outVar,
			})
		} else {
			inner.push({
				kind: 'Append',
				content: `<${tagName}${attrString}>`,
				outVar,
			})

			const isScript = tagName === 'script'
			const isStyle = tagName === 'style'
			let closeBlock = false

			if (isScript && passDataExpr) {
				const result = this.emitScriptPassDataIR(passDataExpr, node, outVar)
				inner.push(...result.nodes)
				closeBlock = result.closeBlock
			} else if (isStyle && passDataExpr) {
				inner.push({ kind: 'StylePassData', passDataExpr, outVar })
			}

			inner.push(...this.compileChildNodes(node.childNodes, childSkip, outVar))

			if (closeBlock) {
				inner.push({ kind: 'Append', content: '\\n}\\n', outVar })
			}

			inner.push({ kind: 'Append', content: `</${tagName}>`, outVar })
		}

		if (loopData) {
			return [
				{
					kind: 'For',
					binding: loopData.binding,
					items: loopData.items,
					body: inner,
				},
			]
		}
		return inner
	}

	private emitScriptPassDataIR(
		passDataExpr: string,
		node: any,
		outVar: string
	): { nodes: IRNode[]; closeBlock: boolean } {
		const isModule = node.getAttribute('type') === 'module'
		const nodes: IRNode[] = [{ kind: 'ScriptPassData', passDataExpr, isModule, outVar }]
		return { nodes, closeBlock: !isModule }
	}

	/**
	 * Slot content must use the same sibling-based rules as {@link compileChildNodes}, including
	 * `if` / `else-if` / `else` chains. A plain `for` over `compileNode` would miss those chains
	 * (e.g. wrapperless `<template if>` inside `<base-layout>`).
	 */
	private compileSlotChildList(
		children: any[],
		skipInterpolation: boolean,
		outVar: string
	): IRNode[] {
		const slotIR: IRNode[] = []
		let i = 0
		while (i < children.length) {
			const child = children[i]
			if (child.nodeType === 1) {
				const childTagName = child.tagName?.toLowerCase()
				if (
					childTagName === CONST.TAG_SLOT &&
					child.hasAttribute(CONST.ATTR_NAME) &&
					child.hasAttribute(CONST.ATTR_SLOT)
				) {
					const passthroughName = child.getAttribute(CONST.ATTR_NAME)
					const defaultContent = this.compileSlotDefaultContent(
						child.childNodes,
						skipInterpolation
					)
					slotIR.push({
						kind: 'Slot',
						name: passthroughName,
						defaultContent,
						outVar,
					})
					i++
					continue
				}
			}

			if (child.nodeType === 1 && hasIfAttr(child)) {
				const parent = child.parentNode
				if (parent?.childNodes) {
					const startIndex = Array.prototype.indexOf.call(parent.childNodes as NodeList, child)
					if (startIndex >= 0) {
						const { nodes: chainNodes, consumed } = compileConditionalChain(
							{
								compileBranchBody: (n, skip, o) =>
									this.compileWrapperAwareBranch(n, skip, o),
							},
							this.diag,
							parent.childNodes,
							startIndex,
							skipInterpolation,
							outVar
						)
						slotIR.push(...chainNodes)
						const consumedSet = new Set<unknown>()
						for (let j = startIndex; j < startIndex + consumed; j++) {
							consumedSet.add(parent.childNodes[j])
						}
						while (i < children.length && consumedSet.has(children[i])) {
							i++
						}
						continue
					}
				}
			}

			slotIR.push(...this.compileNode(child, skipInterpolation, outVar))
			i++
		}
		return slotIR
	}

	private compileComponent(
		node: any,
		tagName: string,
		skipInterpolation: boolean,
		outVar: string
	): IRNode[] {
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = Helper.kebabToCamelCase(kebabBase)
		const { propsString } = parseComponentAttributes(node, this.diag)

		const slotVarMap: Record<string, string> = {}
		const slotContentMap: Record<string, any[]> = {
			[CONST.SLOT_NAME_DEFAULT]: [],
		}

		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i]
				let slotName = CONST.SLOT_NAME_DEFAULT
				if (child.nodeType === 1) {
					const slotAttr = child.getAttribute(CONST.ATTR_SLOT)
					if (slotAttr) slotName = slotAttr
				}
				slotContentMap[slotName] = slotContentMap[slotName] || []
				slotContentMap[slotName]!.push(child)
			}
		}

		const slots: Record<string, IRNode[]> = {}
		for (const [slotName, children] of Object.entries(slotContentMap)) {
			const slotVar = `__slot_${this.slotCounter++}`
			slotVarMap[slotName] = slotVar

			slots[slotName] = this.compileSlotChildList(children, skipInterpolation, slotVar)
		}

		return [
			{
				kind: 'Component',
				baseName,
				propsString,
				slots,
				slotVarMap,
				outVar,
			},
		]
	}
}
