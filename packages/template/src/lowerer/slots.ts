/**
 * Slot default content and `<slot>` lowering helpers.
 */

import * as CONST from '../constants'
import * as Helper from '../helpers'
import type { IRNode } from '../ir'
import type { ParsedElementAttrs } from './types'

export interface SlotDefaultContentDeps {
	parseElementAttributes(node: any): ParsedElementAttrs
	parseComponentAttributes(node: any): { propsString: string }
}

/** Compiles slot default content into template literal content (for simple fallbacks). */
export function compileSlotDefaultContent(
	nodes: NodeList | undefined,
	skipInterpolation: boolean,
	deps: SlotDefaultContentDeps,
	compileElementDefaultContent: (node: any, skip: boolean) => string
): string {
	if (!nodes) return ''
	let out = ''
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i] as any
		if (!node) continue
		if (node.nodeType === 3) {
			const text = node.textContent || ''
			if (text) {
				out += skipInterpolation ? Helper.escapeBackticks(text) : Helper.compileInterpolation(text)
			}
		} else if (node.nodeType === 1) {
			out += compileElementDefaultContent(node, skipInterpolation)
		}
	}
	return out
}

/** Compiles an element for slot default content (template literal format). */
export function compileElementDefaultContent(
	node: any,
	skipInterpolation: boolean,
	deps: SlotDefaultContentDeps,
	compileSlotDefaultContentBound: (nodes: NodeList | undefined, skip: boolean) => string
): string {
	const tagName = node.tagName.toLowerCase()

	if (tagName === CONST.TAG_SLOT) {
		const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
		const defaultContent = compileSlotDefaultContentBound(node.childNodes, skipInterpolation)
		// Mirror {@link Helper.emitSlotOutput}: fallback must be a template-literal string, not raw markup tokens.
		return `\${ slots['${slotName}'] ?? \`${Helper.escapeBackticks(defaultContent)}\` }`
	}

	if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = Helper.kebabToCamelCase(kebabBase)
		const { propsString } = deps.parseComponentAttributes(node)
		return `\${ await Aero.renderComponent(${baseName}, ${propsString}, {}, ${Helper.getRenderComponentContextArg()}) }`
	}

	const { attrString } = deps.parseElementAttributes(node)

	if (CONST.VOID_TAGS.has(tagName)) {
		return `<${tagName}${attrString}>`
	}

	const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
	const children = compileSlotDefaultContentBound(node.childNodes, childSkip)
	return `<${tagName}${attrString}>${children}</${tagName}>`
}

export function compileSlot(
	node: any,
	skipInterpolation: boolean,
	outVar: string,
	compileSlotDefaultContentBound: (nodes: NodeList | undefined, skip: boolean) => string
): IRNode[] {
	const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
	const defaultContent = compileSlotDefaultContentBound(node.childNodes, skipInterpolation)
	return [{ kind: 'Slot', name: slotName, defaultContent, outVar }]
}
