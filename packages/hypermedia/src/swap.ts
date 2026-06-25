import type { SwapOperation, SwapStyle } from './types'

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

function swapOuterHTML(target: Element, html: string): void {
	const temp = document.createElement('template')
	temp.innerHTML = html
	const fragment = temp.content
	if (target.parentNode) {
		target.parentNode.replaceChild(fragment, target)
	}
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
	swapOuterHTML(target, html)
}

function swapRemove(target: Element, _html: string): void {
	target.remove()
}

function swapNone(_target: Element, _html: string): void {
}

const SWAP_FUNCTIONS: Record<SwapStyle, (target: Element, html: string) => void> = {
	innerHTML: swapInnerHTML,
	outerHTML: swapOuterHTML,
	beforebegin: swapBeforeBegin,
	afterbegin: swapAfterBegin,
	beforeend: swapBeforeEnd,
	afterend: swapAfterEnd,
	replace: swapReplace,
	remove: swapRemove,
	none: swapNone,
}

export function performSwap(op: SwapOperation): void {
	const fn = SWAP_FUNCTIONS[op.style]
	if (!fn) {
		throw new Error(`[aero] Unknown swap style: ${op.style}`)
	}
	fn(op.target, op.html)
}

export function performSwaps(ops: readonly SwapOperation[]): void {
	for (const op of ops) {
		performSwap(op)
	}
}
