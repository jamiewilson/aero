import type { StateScope } from './state-scope'
import type { StateBindingSpec } from './state-scope'
import type { SignalStore } from './store'
import type { HypermediaRuntimeLike } from './mount'
import {
	createEventHandlerActionScope,
	rewriteHypermediaActionStateRefs,
} from '@aero-js/compiler'

export type ScopeReader = (
	scope: StateScope,
	escapeHtml?: (value: unknown) => string
) => unknown

export type ScopeWriter = (scope: StateScope, value: unknown) => void

export type CompiledEventHandler = (
	scope: StateScope,
	actions: Record<string, unknown>,
	event: Event,
	self: Element
) => void

/** @internal Trusted-content eval helpers — not used by compiled mounts. */
export function unsafeCompileRead(
	readExpr: string,
	scope: StateScope,
	escapeHtml?: (value: unknown) => string
): () => unknown {
	const params = escapeHtml ? ['scope', 'escapeHtml'] : ['scope']
	const args = escapeHtml ? [scope, escapeHtml] : [scope]
	// eslint-disable-next-line @typescript-eslint/no-implied-eval
	return new Function(...params, `return function() { with (scope) { return (${readExpr}); } }`)(
		...args
	) as () => unknown
}

export function unsafeCompileHandler(
	handlerExpr: string,
	scope: StateScope,
	options: {
		hypermediaRuntime?: HypermediaRuntimeLike
		store: SignalStore
		bindings: readonly StateBindingSpec[]
		hypermediaTriggerRef?: { current: Element | undefined }
	}
): (this: Element, event: Event) => void {
	const signalNames = new Set(options.bindings.filter(binding => !binding.derived).map(binding => binding.name))
	const rewrittenExpr = rewriteHypermediaActionStateRefs(handlerExpr, signalNames)
	const body = rewrittenExpr.trim().endsWith(';') ? rewrittenExpr.trim() : `${rewrittenExpr.trim()};`
	return function (this: Element, event: Event) {
		const triggerRef = options.hypermediaTriggerRef
		if (triggerRef) triggerRef.current = this
		try {
			const actionScope = options.hypermediaRuntime
				? createEventHandlerActionScope(
						options.hypermediaRuntime,
						() => this,
						name => {
							const binding = options.bindings.find(item => item.name === name)
							if (!binding) throw new Error(`[aero] Hypermedia state signal not found: ${name}`)
							const signal = options.store.get(name)
							if (typeof signal.value !== 'boolean') {
								throw new Error(`[aero] Hypermedia state signal must be boolean: ${name}`)
							}
							return signal as { value: boolean }
						}
					)
				: {}
			// eslint-disable-next-line @typescript-eslint/no-implied-eval
			const fn = new Function(
				'scope',
				'actions',
				'event',
				`return function() { with (scope) { with (actions) { with ({ event }) { ${body} } } } }`
			)(scope, actionScope, event) as () => void
			fn.call(this)
		} finally {
			if (triggerRef) triggerRef.current = undefined
		}
	}
}
