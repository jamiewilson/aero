import {
	HYPERMEDIA_COMPILED_SIGNAL_CALLEE,
	HYPERMEDIA_SIGNAL_RESOLVER,
} from './event-handler-action-scope'

export interface RewriteHypermediaActionStateRefsOptions {
	/** e.g. `actions.__aeroSignal` for compiled handlers; default bare `__aeroSignal`. */
	signalCallee?: string
}

/** Rewrite `state: bindingName` to a hypermedia signal resolver call (mount + editor). */
export function rewriteHypermediaActionStateRefs(
	handlerExpr: string,
	signalNames: ReadonlySet<string>,
	options?: RewriteHypermediaActionStateRefsOptions
): string {
	if (signalNames.size === 0) return handlerExpr
	const callee = options?.signalCallee ?? HYPERMEDIA_SIGNAL_RESOLVER
	return handlerExpr.replace(
		/(\bstate\s*:\s*)([A-Za-z_$][\w$]*)/g,
		(match, prefix: string, name: string) => {
			if (!signalNames.has(name)) return match
			return `${prefix}${callee}(${JSON.stringify(name)})`
		}
	)
}

/** Default callee for compiled mount handlers. */
export const COMPILED_HYPERMEDIA_STATE_SIGNAL_CALLEE = HYPERMEDIA_COMPILED_SIGNAL_CALLEE
