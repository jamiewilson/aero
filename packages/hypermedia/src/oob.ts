import { parseSwapStyle } from './swap'
import type { SwapStyle } from './types'

export interface OobSwap {
	readonly id: string
	readonly html: string
	readonly style: SwapStyle
}

export function parseOobSwaps(html: string): { primaryHtml: string; oobSwaps: OobSwap[] } {
	const template = document.createElement('template')
	template.innerHTML = html

	const oobSwaps: OobSwap[] = []
	const oobElements = [...template.content.querySelectorAll('[data-aero-oob]')]

	for (const element of oobElements) {
		const id = element.id
		if (!id) continue
		const style = parseSwapStyle(element.getAttribute('data-aero-oob') ?? '') ?? 'outerHTML'
		oobSwaps.push({ id, html: element.outerHTML, style })
		element.remove()
	}

	return { primaryHtml: template.innerHTML, oobSwaps }
}
