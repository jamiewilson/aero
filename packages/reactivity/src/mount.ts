import { Effect } from './effect'
import { createStateScope, type StateBindingSpec, type StateScope } from './state-scope'
import type { SignalStore } from './store'

export type Cleanup = () => void

export function bindText(target: Node, read: () => unknown): Cleanup {
	const effect = new Effect(() => {
		const value = read()
		target.textContent = value == null ? '' : String(value)
	})
	return () => effect.destroy()
}

export function bindEvent(target: Element, event: string, handler: (event: Event) => void): Cleanup {
	target.addEventListener(event, handler)
	return () => target.removeEventListener(event, handler)
}

export interface MountStateBindingsOptions {
	readonly root: ParentNode
	readonly store: SignalStore
	readonly bindings: readonly StateBindingSpec[]
	readonly functionSources: readonly string[]
	readonly textBinds: readonly { selector: string; readExpr: string }[]
	readonly eventBinds: readonly { selector: string; event: string; handlerExpr: string }[]
	readonly escapeHtml?: (value: unknown) => string
	/** External functions to inject into the handler eval scope (e.g. hypermedia actions). */
	readonly actionFunctions?: Record<string, (...args: unknown[]) => unknown>
}

function compileHandler(handlerExpr: string, scope: StateScope): (event: Event) => void {
	const body = handlerExpr.trim().endsWith(';') ? handlerExpr.trim() : `${handlerExpr.trim()};`
	return new Function(
		'scope',
		'event',
		`return function(event) { with (scope) { ${body} } }`
	)(scope) as (event: Event) => void
}

function compileRead(
	readExpr: string,
	scope: StateScope,
	escapeHtml?: (value: unknown) => string
): () => unknown {
	const params = escapeHtml ? ['scope', 'escapeHtml'] : ['scope']
	const args = escapeHtml ? [scope, escapeHtml] : [scope]
	return new Function(...params, `return function() { with (scope) { return (${readExpr}); } }`)(
		...args
	) as () => unknown
}

/**
 * Wire compiled reactive text and base event handlers against a hydrated signal store.
 */
export function mountStateBindings(options: MountStateBindingsOptions): Cleanup {
	const scope = createStateScope({
		store: options.store,
		bindings: options.bindings,
		functionSources: options.functionSources,
		actionFunctions: options.actionFunctions,
	})
	const cleanups: Cleanup[] = []

	for (const bind of options.textBinds) {
		const target = options.root.querySelector(bind.selector)
		if (!target) {
			throw new Error(`[aero] Missing reactive text target: ${bind.selector}`)
		}
		cleanups.push(bindText(target, compileRead(bind.readExpr, scope, options.escapeHtml)))
	}

	for (const bind of options.eventBinds) {
		const target = options.root.querySelector(bind.selector)
		if (!target || typeof (target as Element).addEventListener !== 'function') {
			throw new Error(`[aero] Missing reactive event target: ${bind.selector}`)
		}
		cleanups.push(bindEvent(target as Element, bind.event, compileHandler(bind.handlerExpr, scope)))
	}

	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}
