import { Effect } from './effect'
import { createStateScope, type StateBindingSpec, type StateScope } from './state-scope'
import type { SignalStore } from './store'

export type Cleanup = () => void

export interface HypermediaRuntimeLike {
	executeAction(
		options: {
			method?: string
			url?: string
			target?: string
			swap?: string
			pushUrl?: boolean | string
			autoDisable?: boolean
			state?: { value: boolean }
		},
		trigger?: Element
	): Promise<unknown>
	registerBusyBinding(element: Element, signalName: string, signal: { value: boolean }): Cleanup
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
	trigger: Element,
	resolveSignal: (name: string) => { value: boolean }
): Record<string, (...args: unknown[]) => unknown> {
	const scope: Record<string, (...args: unknown[]) => unknown> = {}
	for (const method of HYPERMEDIA_METHODS) {
		scope[method] = (url: unknown, opts: unknown = {}) =>
			runtime.executeAction(
				{ ...(opts as object), method, url: String(url) },
				trigger
			)
	}
	scope.__aeroSignal = (name: unknown) => resolveSignal(String(name))
	return scope
}

function rewriteActionStateRefs(handlerExpr: string, signalNames: ReadonlySet<string>): string {
	if (signalNames.size === 0) return handlerExpr
	return handlerExpr.replace(
		/(\bstate\s*:\s*)([A-Za-z_$][\w$]*)/g,
		(match, prefix: string, name: string) => {
			if (!signalNames.has(name)) return match
			return `${prefix}__aeroSignal(${JSON.stringify(name)})`
		}
	)
}

function getBooleanSignal(store: SignalStore, bindings: readonly StateBindingSpec[], name: string): { value: boolean } {
	const binding = bindings.find(item => item.name === name)
	if (!binding) {
		throw new Error(`[aero] Hypermedia state signal not found in state scope: ${name}`)
	}
	if (binding.derived) {
		throw new Error(`[aero] Hypermedia state signal must be writable: ${name}`)
	}
	const signal = store.get(name)
	if (typeof signal.value !== 'boolean') {
		throw new Error(`[aero] Hypermedia state signal must be boolean: ${name}`)
	}
	return signal as { value: boolean }
}

function compileHandler(
	handlerExpr: string,
	scope: StateScope,
	options: {
		hypermediaRuntime?: HypermediaRuntimeLike
		store: SignalStore
		bindings: readonly StateBindingSpec[]
	}
): (this: Element, event: Event) => void {
	const signalNames = new Set(options.bindings.filter(binding => !binding.derived).map(binding => binding.name))
	const rewrittenExpr = rewriteActionStateRefs(handlerExpr, signalNames)
	const body = rewrittenExpr.trim().endsWith(';') ? rewrittenExpr.trim() : `${rewrittenExpr.trim()};`
	return function (this: Element, event: Event) {
		const actionScope = options.hypermediaRuntime
			? createHypermediaActionScope(
					options.hypermediaRuntime,
					this,
					name => getBooleanSignal(options.store, options.bindings, name)
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
	store: SignalStore,
	bindings: readonly StateBindingSpec[],
	runtime: HypermediaRuntimeLike
): Cleanup {
	const signalName = readExpr.trim()
	const signal = getBooleanSignal(store, bindings, signalName)
	return runtime.registerBusyBinding(target, signalName, signal)
}

function isElementLike(value: unknown): value is Element {
	return !!value && typeof value === 'object'
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
				compileHandler(bind.handlerExpr, scope, {
					hypermediaRuntime: options.hypermediaRuntime,
					store: options.store,
					bindings: options.bindings,
				}),
				bind.modifiers ?? []
			)
		)
	}

	if (options.busyBinds && options.hypermediaRuntime) {
		for (const bind of options.busyBinds) {
			const target = options.root.querySelector(bind.selector)
			if (!isElementLike(target)) {
				throw new Error(`[aero] Missing busy target: ${bind.selector}`)
			}
			cleanups.push(
				registerBusyBinding(target, bind.readExpr, options.store, options.bindings, options.hypermediaRuntime)
			)
		}
	}

	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}
