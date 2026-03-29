/**
 * Walks linkedom DOM and lowers to IR (elements, components, slots, for, if/else chains).
 */

import type { IRNode } from '../ir'
import * as CONST from '../constants'
import * as Helper from '../helpers'
import { Resolver } from '../resolver'
import { parseElementAttributes, parseComponentAttributes } from './attributes'
import { compileConditionalChain, hasIfAttr } from './conditionals'
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
						compileElement: (n, skip, o) => this.compileElement(n, skip, o),
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

			const slotIR: IRNode[] = []
			for (const child of children) {
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
							outVar: slotVar,
						})
						continue
					}
				}
				slotIR.push(...this.compileNode(child, skipInterpolation, slotVar))
			}
			slots[slotName] = slotIR
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
