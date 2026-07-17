/**
 * Helpers for hoisting reactive bind markers onto authored elements
 * instead of injecting wrapper spans.
 */

import { hasIfAttr } from './conditionals'

export function isIgnorableSibling(node: Node): boolean {
	if (node.nodeType === 8) return true
	if (node.nodeType === 3) return (node.textContent ?? '').trim() === ''
	return false
}

export function countElementSiblings(nodes: NodeList | undefined): number {
	if (!nodes) return 0
	let count = 0
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i]!.nodeType === 1) count++
	}
	return count
}

export function findOnlyElementSibling(nodes: NodeList | undefined): Element | null {
	if (!nodes) return null
	let found: Element | null = null
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i]!
		if (isIgnorableSibling(node)) continue
		if (node.nodeType !== 1) return null
		if (found) return null
		found = node as Element
	}
	return found
}

/** True when every non-ignorable sibling lies in [start, start + consumed). */
export function isOnlySiblingContent(
	nodes: NodeList | undefined,
	start: number,
	consumed: number
): boolean {
	if (!nodes) return false
	for (let i = 0; i < nodes.length; i++) {
		if (i >= start && i < start + consumed) continue
		if (!isIgnorableSibling(nodes[i]!)) return false
	}
	return true
}

export function firstIfChainIndex(nodes: NodeList | undefined): number {
	if (!nodes) return -1
	for (let i = 0; i < nodes.length; i++) {
		if (hasIfAttr(nodes[i])) return i
	}
	return -1
}

export function injectReactiveMarkerOnOpenTag(
	openTagContent: string,
	directive: 'if' | 'for' | 'switch' | 'text',
	bindId: number
): string {
	const attr = `data-aero-${directive}="${bindId}"`
	if (openTagContent.endsWith('>')) {
		return `${openTagContent.slice(0, -1)} ${attr}>`
	}
	return `${openTagContent} ${attr}>`
}
