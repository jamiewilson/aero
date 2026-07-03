import { Idiomorph } from 'idiomorph'
import type { SwapOperation, SwapStyle } from './types'

const IGNORE_MORPH_ATTR = 'data-aero-ignore-morph'

function shouldIgnoreMorph(node: Node): boolean {
	return node instanceof Element && node.hasAttribute(IGNORE_MORPH_ATTR)
}

const SWAP_STYLES: readonly SwapStyle[] = [
	'innerHTML',
	'outerHTML',
	'beforebegin',
	'afterbegin',
	'beforeend',
	'afterend',
	'replace',
	'remove',
	'none',
]

export function parseSwapStyle(value: string): SwapStyle | null {
	const trimmed = value.trim().toLowerCase()
	const match = SWAP_STYLES.find(s => s.toLowerCase() === trimmed)
	return match ?? null
}

export function resolveTarget(selector: string, context: ParentNode = document): Element | null {
	if (selector === 'this' || !selector) return null
	return context.querySelector(selector)
}

function swapInnerHTML(target: Element, html: string): void {
	target.innerHTML = html
}

function swapOuterHTML(target: Element, html: string): Element[] {
	const temp = document.createElement('template')
	temp.innerHTML = html
	const fragment = temp.content
	const inserted = [...fragment.children] as Element[]
	if (target.parentNode) {
		target.parentNode.replaceChild(fragment, target)
	}
	return inserted
}

function swapBeforeBegin(target: Element, html: string): void {
	target.insertAdjacentHTML('beforebegin', html)
}

function swapAfterBegin(target: Element, html: string): void {
	target.insertAdjacentHTML('afterbegin', html)
}

function swapBeforeEnd(target: Element, html: string): void {
	target.insertAdjacentHTML('beforeend', html)
}

function swapAfterEnd(target: Element, html: string): void {
	target.insertAdjacentHTML('afterend', html)
}

function swapReplace(target: Element, html: string): void {
	Idiomorph.morph(target, html, {
		morphStyle: 'outerHTML',
		ignoreActiveValue: true,
		restoreFocus: true,
		callbacks: {
			beforeNodeMorphed(oldNode, newNode) {
				if (shouldIgnoreMorph(oldNode) || shouldIgnoreMorph(newNode)) return false
				return true
			},
		},
	})
}

function swapRemove(target: Element, _html: string): void {
	target.remove()
}

const SWAP_FUNCTIONS: Record<SwapStyle, (target: Element, html: string) => readonly Element[]> = {
	innerHTML: (target, html) => {
		swapInnerHTML(target, html)
		return []
	},
	outerHTML: swapOuterHTML,
	beforebegin: (target, html) => {
		swapBeforeBegin(target, html)
		return []
	},
	afterbegin: (target, html) => {
		swapAfterBegin(target, html)
		return []
	},
	beforeend: (target, html) => {
		swapBeforeEnd(target, html)
		return []
	},
	afterend: (target, html) => {
		swapAfterEnd(target, html)
		return []
	},
	replace: (target, html) => {
		swapReplace(target, html)
		return []
	},
	remove: (target, html) => {
		swapRemove(target, html)
		return []
	},
	none: () => [],
}

function pickInsertedProcessContainer(insertedRoots: readonly Element[]): ParentNode | null {
	const connected = insertedRoots.filter(el => el.isConnected)
	if (connected.length === 0) return null
	if (connected.length === 1) return connected[0]!
	const parent = connected[0]!.parentElement
	if (parent?.isConnected && connected.every(el => el.parentElement === parent)) {
		return parent
	}
	return null
}

export function resolveSwapProcessContainer(
	target: Element,
	style: SwapStyle,
	targetSelector: string,
	context: ParentNode = target.ownerDocument ?? document,
	insertedRoots: readonly Element[] = []
): ParentNode {
	if (style === 'outerHTML' || style === 'replace') {
		const next = resolveTarget(targetSelector, context)
		if (next?.isConnected) return next
	}

	if (target.isConnected) return target

	const resolved = resolveTarget(targetSelector, context)
	if (resolved?.isConnected) return resolved

	const inserted = pickInsertedProcessContainer(insertedRoots)
	if (inserted) return inserted

	const parent = target.parentElement
	if (parent?.isConnected) return parent

	return context instanceof Document ? context.body : context
}

export function performSwap(op: SwapOperation): readonly Element[] {
	const fn = SWAP_FUNCTIONS[op.style]
	if (!fn) {
		throw new Error(`[aero] Unknown swap style: ${op.style}`)
	}
	return fn(op.target, op.html)
}

export function performSwaps(ops: readonly SwapOperation[]): void {
	for (const op of ops) {
		performSwap(op)
	}
}
