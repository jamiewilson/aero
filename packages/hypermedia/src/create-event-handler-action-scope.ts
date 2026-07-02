import {
	HYPERMEDIA_HTTP_METHODS,
	HYPERMEDIA_SIGNAL_RESOLVER,
} from './event-handler-action-scope'

export interface EventHandlerActionExecutor {
	executeAction(options: Record<string, unknown>, trigger?: Element): unknown
}

/** Build the `actions` object passed to compiled `on:*` handlers at mount time. */
export function createEventHandlerActionScope(
	runtime: EventHandlerActionExecutor,
	getTrigger: () => Element | undefined,
	resolveSignal: (name: string) => { value: boolean }
): Record<string, unknown> {
	const scope: Record<string, unknown> = {}
	for (const method of HYPERMEDIA_HTTP_METHODS) {
		scope[method] = (url: unknown, opts: unknown = {}) =>
			runtime.executeAction(
				{ ...(opts as object), method, url: String(url) },
				getTrigger()
			)
	}
	scope[HYPERMEDIA_SIGNAL_RESOLVER] = (name: unknown) => resolveSignal(String(name))
	return scope
}
