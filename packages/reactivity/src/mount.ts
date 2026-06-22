import { Effect } from './effect'
import { createStateScope, type StateBindingSpec, type StateScope } from './state-scope'
import type { SignalStore } from './store'

export type Cleanup = () => void

export interface HypermediaRuntimeLike {
	executeAction(
		options: { method?: string; url?: string; target?: string; swap?: string; pushUrl?: boolean | string },
		trigger?: Element
	): Promise<unknown>
	registerBusyBinding(element: Element, signalName: string, setBusy: (value: boolean) => void): void
}

export function bindText(target: Node, read: () => unknown): Cleanup {
	const effect = new Effect(() => {
		const value = read()
		target.textContent = value == null ? '' : String(value)
	})
	return () => effect.destroy()
}

export function bindEvent(
	target: Element,
	event: string,
	handler: (this: Element, event: Event) => void,
	modifiers: readonly string[] = []
): Cleanup {
	const listener = function (this: Element, event: Event) {
		if (modifiers.includes('prevent')) event.preventDefault()
		if (modifiers.includes('stop')) event.stopPropagation()
		if (modifiers.includes('self') && event.target !== this) return
		handler.call(this, event)
	}
	target.addEventListener(event, listener as EventListener)
	return () => target.removeEventListener(event, listener as EventListener)
}

export interface MountStateBindingsOptions {
	readonly root: ParentNode
	readonly store: SignalStore
	readonly bindings: readonly StateBindingSpec[]
	readonly functionSources: readonly string[]
	readonly textBinds: readonly { selector: string; readExpr: string }[]
	readonly eventBinds: readonly {
		selector: string
		event: string
		handlerExpr: string
		modifiers?: readonly string[]
	}[]
	readonly busyBinds?: readonly { selector: string; readExpr: string }[]
	readonly scopeConstants?: Record<string, unknown>
	readonly escapeHtml?: (value: unknown) => string
	readonly actionFunctions?: Record<string, (...args: unknown[]) => unknown>
	readonly hypermediaRuntime?: HypermediaRuntimeLike
}

const HYPERMEDIA_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

function createHypermediaActionScope(
	runtime: HypermediaRuntimeLike,
	trigger: Element
): Record<string, (...args: unknown[]) => unknown> {
	const scope: Record<string, (...args: unknown[]) => unknown> = {}
	for (const method of HYPERMEDIA_METHODS) {
		scope[method] = (url: unknown, opts: unknown = {}) =>
			runtime.executeAction(
				{ ...(opts as object), method, url: String(url) },
				trigger
			)
	}
	return scope
}

function compileHandler(
	handlerExpr: string,
	scope: StateScope,
	hypermediaRuntime?: HypermediaRuntimeLike
): (this: Element, event: Event) => void {
	const body = handlerExpr.trim().endsWith(';') ? handlerExpr.trim() : `${handlerExpr.trim()};`
	return function (this: Element, event: Event) {
		const actionScope = hypermediaRuntime ? createHypermediaActionScope(hypermediaRuntime, this) : {}
		const handlerScope = { ...scope, ...actionScope, event }
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const fn = new Function('scope', `return function() { with (scope) { ${body} } }`)(handlerScope) as () => void
		fn.call(this)
	}
}

function compileRead(
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

function registerBusyBinding(
	target: Element,
	readExpr: string,
	scope: StateScope,
	store: SignalStore,
	runtime: HypermediaRuntimeLike
): void {
	const signalName = readExpr.trim()
	if (!store.has(signalName)) {
		throw new Error(`[aero] Busy signal not found in state scope: ${signalName}`)
	}
	const signal = store.get(signalName) as { value: boolean }
	runtime.registerBusyBinding(target, signalName, value => {
		signal.value = value
	})
}

/**
 * Wire compiled reactive text and base event handlers against a hydrated signal store.
 */
export function mountStateBindings(options: MountStateBindingsOptions): Cleanup {
	const scope = createStateScope({
		store: options.store,
		bindings: options.bindings,
		functionSources: options.functionSources,
		actionFunctions: options.hypermediaRuntime ? undefined : options.actionFunctions,
		scopeConstants: options.scopeConstants,
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
		cleanups.push(
			bindEvent(
				target as Element,
				bind.event,
				compileHandler(bind.handlerExpr, scope, options.hypermediaRuntime),
				bind.modifiers ?? []
			)
		)
	}

	if (options.busyBinds && options.hypermediaRuntime) {
		for (const bind of options.busyBinds) {
			const target = options.root.querySelector(bind.selector)
			if (!target || !(target instanceof Element)) {
				throw new Error(`[aero] Missing busy target: ${bind.selector}`)
			}
			registerBusyBinding(target, bind.readExpr, scope, options.store, options.hypermediaRuntime)
		}
	}

	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}
