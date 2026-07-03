import type { ActionOptions, HttpMethod, HypermediaBooleanSignal, HypermediaSignalStore, SwapStyle } from './types'
import type { HypermediaRuntime } from './runtime'

const HYPERMEDIA_ON_PREFIX = 'data-aero-on-'
const HYPERMEDIA_BUSY_ATTR = 'data-aero-busy'

interface ParsedAction {
	method: HttpMethod
	url: string
	options: ActionOptions
}

function stripBraces(value: string): string {
	const trimmed = value.trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}')
		? trimmed.slice(1, -1).trim()
		: trimmed
}

function resolveSignalRef(ref: string, store: HypermediaSignalStore | undefined): HypermediaBooleanSignal {
	if (!store) {
		throw new Error(`[aero] Hypermedia signal reference ${JSON.stringify(ref)} requires a SignalStore.`)
	}
	const path = ref.trim().replace(/^\$/, '')
	if (!path) {
		throw new Error('[aero] Empty hypermedia signal reference.')
	}
	if (store.has && !store.has(path)) {
		throw new Error(`[aero] Hypermedia signal not found: ${path}`)
	}
	const signal = store.get(path)
	if (typeof signal.value !== 'boolean') {
		throw new Error(`[aero] Hypermedia signal must be boolean: ${path}`)
	}
	return signal as HypermediaBooleanSignal
}

function parseActionExpression(expr: string, store?: HypermediaSignalStore): ParsedAction | null {
	const trimmed = expr.trim()
	const inner = stripBraces(trimmed)

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
		const stateMatch = optsRaw.match(/state:\s*\$(\w+(?:\.\w+)*)/)
		const autoDisableMatch = optsRaw.match(/autoDisable:\s*(true|false)/)
		if (targetMatch) options.target = targetMatch[1]
		if (swapMatch) options.swap = swapMatch[1] as SwapStyle
		if (stateMatch) options.state = resolveSignalRef(`$${stateMatch[1]}`, store)
		if (autoDisableMatch) options.autoDisable = autoDisableMatch[1] === 'true'
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

export function process(element: ParentNode, runtime: HypermediaRuntime, store?: HypermediaSignalStore): void {
	const all = element.querySelectorAll<Element>('*')
	for (const el of all) {
		if (el.hasAttribute('data-aero-processed')) continue
		let didProcess = false

		const busyAttr = el.getAttribute(HYPERMEDIA_BUSY_ATTR)
		if (busyAttr) {
			const signalRef = stripBraces(busyAttr)
			if (signalRef.startsWith('$')) {
				runtime.registerBusyBinding(el, signalRef.slice(1), resolveSignalRef(signalRef, store))
				didProcess = true
			}
		}

		for (let i = 0; i < el.attributes.length; i++) {
			const attr = el.attributes[i]
			if (!attr.name.startsWith(HYPERMEDIA_ON_PREFIX)) continue

			const parsed = parseActionExpression(attr.value, store)
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

			didProcess = true
			break
		}

		if (didProcess) {
			el.setAttribute('data-aero-processed', '')
		}
	}
}
