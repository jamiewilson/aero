import type { HttpMethod } from './types'

/** HTTP verbs exposed as functions on the `actions` param in compiled `on:*` handlers. */
export const HYPERMEDIA_HTTP_METHODS = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
] as const satisfies readonly HttpMethod[]

/** Resolves a writable boolean state binding for hypermedia `state` options. */
export const HYPERMEDIA_SIGNAL_RESOLVER = '__aeroSignal' as const

/** Names injected on the `actions` argument for event handlers (mount + editor). */
export const HYPERMEDIA_EVENT_HANDLER_ACTIONS = [
	...HYPERMEDIA_HTTP_METHODS,
	HYPERMEDIA_SIGNAL_RESOLVER,
] as const

export const HYPERMEDIA_HTTP_METHOD_SET = new Set<string>(HYPERMEDIA_HTTP_METHODS)

export const HYPERMEDIA_EVENT_HANDLER_ACTION_SET = new Set<string>(HYPERMEDIA_EVENT_HANDLER_ACTIONS)

/** Qualified callee for CSP-safe compiled mount handlers (`actions` param, no `with`). */
export const HYPERMEDIA_COMPILED_SIGNAL_CALLEE =
	`actions.${HYPERMEDIA_SIGNAL_RESOLVER}` as const

const HTTP_METHOD_UNION = HYPERMEDIA_HTTP_METHODS.map(method => `'${method}'`).join(' | ')

/** Virtual TS prelude for hypermedia names in `on:*` handler bodies. */
export function buildHypermediaActionScopeDecl(): string {
	const methodDecls = HYPERMEDIA_HTTP_METHODS.map(
		method =>
			`declare function ${method}(url: string, options?: HypermediaActionOptions): Promise<HypermediaResponse>`
	).join('\n')

	return `interface HypermediaResponse {
	readonly ok: boolean
	readonly status: number
	readonly html: string
	readonly headers: Record<string, string>
}
interface HypermediaActionOptions {
	method?: ${HTTP_METHOD_UNION}
	target?: string
	swap?: string
	headers?: Record<string, string>
	values?: Record<string, string>
	pushUrl?: boolean | string
	autoDisable?: boolean
	ariaBusy?: boolean
	state?: { value: boolean }
}
declare function ${HYPERMEDIA_SIGNAL_RESOLVER}(name: string): { value: boolean }
${methodDecls}
`
}
