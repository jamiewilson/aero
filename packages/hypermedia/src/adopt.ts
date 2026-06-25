import type { ActionOptions, HttpMethod, SwapStyle } from './types'
import type { HypermediaRuntime } from './runtime'

const HYPERMEDIA_ON_PREFIX = 'data-aero-on-'

interface ParsedAction {
	method: HttpMethod
	url: string
	options: ActionOptions
}

function parseActionExpression(expr: string): ParsedAction | null {
	const trimmed = expr.trim()
	const inner = trimmed.startsWith('{') && trimmed.endsWith('}')
		? trimmed.slice(1, -1).trim()
		: trimmed

	const match = inner.match(
		/^(POST|GET|PUT|PATCH|DELETE)\s*\(\s*(['"])([^'"]*)\2\s*(?:,\s*(\{[^}]*\}))?\s*\)$/
	)
	if (!match) return null

	const method = match[1] as HttpMethod
	const url = match[3]
	const optsRaw = match[4]

	const options: ActionOptions = {}
	if (optsRaw) {
		const targetMatch = optsRaw.match(/target:\s*['"]([^'"]+)['"]/)
		const swapMatch = optsRaw.match(/swap:\s*['"]([^'"]+)['"]/)
		if (targetMatch) options.target = targetMatch[1]
		if (swapMatch) options.swap = swapMatch[1] as SwapStyle
	}

	return { method, url, options }
}

function getEventName(attrName: string): string {
	return attrName.slice(HYPERMEDIA_ON_PREFIX.length) || 'click'
}

function getNativeEventName(eventName: string): string {
	return eventName.split('-')[0]
}

function shouldPreventDefault(eventName: string): boolean {
	return eventName.includes('prevent')
}

export function adopt(container: ParentNode, runtime: HypermediaRuntime): void {
	const all = container.querySelectorAll<Element>('*')
	for (const el of all) {
		if (el.hasAttribute('data-aero-adopted')) continue

		for (let i = 0; i < el.attributes.length; i++) {
			const attr = el.attributes[i]
			if (!attr.name.startsWith(HYPERMEDIA_ON_PREFIX)) continue

			const parsed = parseActionExpression(attr.value)
			if (!parsed) continue

			const attrEvent = getEventName(attr.name)
			const nativeEvent = getNativeEventName(attrEvent)
			const prevent = shouldPreventDefault(attrEvent)

			el.addEventListener(nativeEvent, (e: Event) => {
				if (prevent) e.preventDefault()
				runtime.executeAction({
					method: parsed.method,
					url: parsed.url,
					...parsed.options,
				}, el)
			})

			el.setAttribute('data-aero-adopted', '')
			break
		}
	}
}
