import { Effect } from './effect'
import { createStateScope, type StateBindingSpec, type StateScope } from './state-scope'
import { SignalStore } from './store'
import { bindShow } from './bindings/show'
import { bindHtml } from './bindings/html'
import { bindClassToggle } from './bindings/class'
import { bindProperty } from './bindings/property'
import { bindFormModel } from './bindings/model'
import { bindReactiveIf } from './structural/if'
import { bindKeyedFor } from './structural/for'
import { compileScopeRead } from './scope-eval'

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
	readonly liveProps?: Record<string, { value: unknown }>
	readonly bindings: readonly StateBindingSpec[]
	readonly functionSources: readonly string[]
	/** When set, used instead of creating scope from store/bindings (e.g. keyed-for row scope). */
	readonly scope?: StateScope
	readonly textBinds: readonly { selector: string; readExpr: string }[]
	readonly eventBinds: readonly {
		selector: string
		event: string
		handlerExpr: string
		modifiers?: readonly string[]
	}[]
	readonly busyBinds?: readonly { selector: string; readExpr: string }[]
	readonly showBinds?: readonly { selector: string; readExpr: string }[]
	readonly htmlBinds?: readonly { selector: string; readExpr: string }[]
	readonly classBinds?: readonly { selector: string; className: string; readExpr: string }[]
	readonly propertyBinds?: readonly {
		selector: string
		propertyName: string
		readExpr: string
	}[]
	readonly modelBinds?: readonly {
		selector: string
		modelKind: 'value' | 'checked'
		readExpr: string
		writeExpr: string
		readonly?: boolean
	}[]
	readonly ifBinds?: readonly {
		selector: string
		branches: readonly {
			conditionExpr: string | null
			render: (Aero: unknown) => string
			mounts: MountBindingSubset
		}[]
	}[]
	readonly forBinds?: readonly {
		selector: string
		binding: string
		itemsExpr: string
		keyExpr: string
		renderRow: (Aero: unknown) => string
		rowMounts: MountBindingSubset
	}[]
	readonly componentBinds?: readonly {
		selector: string
		component: unknown
		livePropExprs: Record<string, LivePropExpression>
	}[]
	readonly scopeConstants?: Record<string, unknown>
	readonly escapeHtml?: (value: unknown) => string
	readonly actionFunctions?: Record<string, (...args: unknown[]) => unknown>
	readonly hypermediaRuntime?: HypermediaRuntimeLike
	readonly Aero?: unknown
}

export interface MountBindingSubset {
	readonly textBinds: readonly { selector: string; readExpr: string }[]
	readonly eventBinds: readonly {
		selector: string
		event: string
		handlerExpr: string
		modifiers?: readonly string[]
	}[]
	readonly busyBinds: readonly { selector: string; readExpr: string }[]
	readonly showBinds: readonly { selector: string; readExpr: string }[]
	readonly htmlBinds: readonly { selector: string; readExpr: string }[]
	readonly classBinds: readonly { selector: string; className: string; readExpr: string }[]
	readonly propertyBinds: readonly {
		selector: string
		propertyName: string
		readExpr: string
	}[]
	readonly modelBinds: readonly {
		selector: string
		modelKind: 'value' | 'checked'
		readExpr: string
		writeExpr: string
		readonly?: boolean
	}[]
	readonly componentBinds: readonly {
		selector: string
		component: unknown
		livePropExprs: Record<string, LivePropExpression>
	}[]
}

export type LivePropExpression =
	{
		readonly expr: string
		readonly mutable: boolean
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

function walkQuerySelector(root: Element, selector: string): Element | null {
	if (typeof root.matches === 'function' && root.matches(selector)) return root
	for (let i = 0; i < root.childNodes.length; i++) {
		const node = root.childNodes[i]
		if (node.nodeType !== 1) continue
		const found = walkQuerySelector(node as Element, selector)
		if (found) return found
	}
	return null
}

function isDomDescendantOf(element: Element, ancestor: Element): boolean {
	let cursor: Node | null = element
	while (cursor) {
		if (cursor === ancestor) return true
		cursor = cursor.parentNode
	}
	return false
}

function queryOwnedComponentTarget(componentRoot: Element, selector: string): Element | null {
	const walked = walkQuerySelector(componentRoot, selector)
	if (walked) return walked

	const doc = componentRoot.getRootNode() as ParentNode
	for (const el of doc.querySelectorAll?.(selector) ?? []) {
		if (isDomDescendantOf(el as Element, componentRoot)) {
			return el as Element
		}
	}
	return null
}

function ownsComponentMountRoot(root: ParentNode): boolean {
	return (root as Element).hasAttribute?.('data-aero-component') === true
}

function resolveMountableChildComponentRoots(
	root: ParentNode,
	componentBinds: readonly { selector: string; component: unknown }[] | undefined
): Element[] {
	const roots: Element[] = []
	for (const bind of componentBinds ?? []) {
		if (!getComponentMount(bind.component)) continue
		const target = (root as Element).querySelector?.(bind.selector)
		if (isElementLike(target)) roots.push(target)
	}
	return roots
}

function isStrictDomDescendantOf(element: Element, ancestor: Element): boolean {
	let cursor: Node | null = element.parentNode
	while (cursor) {
		if (cursor === ancestor) return true
		cursor = cursor.parentNode
	}
	return false
}

function isOwnedByChildComponentMount(element: Element, childComponentRoots: readonly Element[]): boolean {
	for (const componentRoot of childComponentRoots) {
		if (isStrictDomDescendantOf(element, componentRoot)) return true
	}
	return false
}

/**
 * Resolve a compiled bind target within a mount root.
 * Page mounts skip markers inside nested child components that export mountStateBindings;
 * component mounts scope to their own component root.
 */
function queryBindTarget(
	root: ParentNode,
	selector: string,
	componentBinds?: readonly { selector: string; component: unknown }[]
): Element | null {
	const rootEl = root as Element
	const ownsComponentRoot = ownsComponentMountRoot(root)
	if (ownsComponentRoot) {
		return queryOwnedComponentTarget(rootEl, selector)
	}

	const childComponentRoots = resolveMountableChildComponentRoots(rootEl, componentBinds)

	if (typeof rootEl.matches === 'function' && rootEl.matches(selector)) {
		if (!isOwnedByChildComponentMount(rootEl, childComponentRoots)) {
			return rootEl
		}
	}

	const matches = rootEl.querySelectorAll?.(selector)
	let target: Element | null = null

	if (matches && matches.length > 0) {
		for (const el of matches) {
			if (isOwnedByChildComponentMount(el as Element, childComponentRoots)) continue
			target = el as Element
			break
		}
	}

	if (!target) {
		const fallback = root.querySelector(selector) as Element | null
		if (fallback && !isOwnedByChildComponentMount(fallback, childComponentRoots)) {
			target = fallback
		}
	}

	return target
}

function getComponentMount(component: unknown): ((root: Element, Aero: unknown, opts?: unknown) => unknown) | null {
	if (component && typeof component === 'object') {
		const direct = (component as { mountStateBindings?: unknown }).mountStateBindings
		if (typeof direct === 'function') return direct as (root: Element, Aero: unknown, opts?: unknown) => unknown
		const nested = (component as { default?: { mountStateBindings?: unknown } }).default?.mountStateBindings
		if (typeof nested === 'function') return nested as (root: Element, Aero: unknown, opts?: unknown) => unknown
	}
	return null
}

function readonlySignal(signalName: string, signal: { value: unknown }): { value: unknown } {
	return {
		get value() {
			return signal.value
		},
		set value(_value: unknown) {
			throw new Error(`[aero] Readonly live prop cannot be assigned: ${signalName}`)
		},
	}
}

function resolveLivePropSignals(
	store: SignalStore,
	livePropExprs: Record<string, LivePropExpression>
): Record<string, { value: unknown }> {
	const liveProps: Record<string, { value: unknown }> = {}
	for (const [propName, livePropExpr] of Object.entries(livePropExprs)) {
		const expr = livePropExpr.expr
		const signalName = expr.trim()
		if (!/^[A-Za-z_$][\w$]*$/.test(signalName)) {
			throw new Error(`[aero] Live prop ${propName} must reference a state signal name.`)
		}
		const signal = store.get(signalName)
		liveProps[propName] =
			livePropExpr.mutable
				? signal
				: readonlySignal(propName, signal)
	}
	return liveProps
}

function mountBindingSubset(
	root: ParentNode,
	scope: StateScope,
	subset: MountBindingSubset,
	options: Pick<
		MountStateBindingsOptions,
		'store' | 'bindings' | 'escapeHtml' | 'hypermediaRuntime' | 'componentBinds' | 'Aero'
	>
): Cleanup[] {
	const cleanups: Cleanup[] = []
	const subsetOptions: MountStateBindingsOptions = {
		root,
		store: options.store,
		bindings: options.bindings,
		functionSources: [],
		textBinds: subset.textBinds,
		eventBinds: subset.eventBinds,
		busyBinds: subset.busyBinds,
		showBinds: subset.showBinds,
		htmlBinds: subset.htmlBinds,
		classBinds: subset.classBinds,
		propertyBinds: subset.propertyBinds,
		modelBinds: subset.modelBinds,
		componentBinds: subset.componentBinds,
		escapeHtml: options.escapeHtml,
		hypermediaRuntime: options.hypermediaRuntime,
		Aero: options.Aero,
		scope,
	}
	cleanups.push(mountStateBindings(subsetOptions))
	return cleanups
}

function mountShowHtmlClassPropertyModel(
	options: MountStateBindingsOptions,
	scope: StateScope,
	cleanups: Cleanup[]
): void {
	for (const bind of options.showBinds ?? []) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!target || !(target instanceof HTMLElement)) {
			if (!target && ownsComponentMountRoot(options.root)) continue
			throw new Error(`[aero] Missing reactive show target: ${bind.selector}`)
		}
		const originalDisplay = target.style.display
		cleanups.push(bindShow(target, compileRead(bind.readExpr, scope), originalDisplay))
	}

	for (const bind of options.htmlBinds ?? []) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!target) {
			if (ownsComponentMountRoot(options.root)) continue
			throw new Error(`[aero] Missing reactive html target: ${bind.selector}`)
		}
		cleanups.push(bindHtml(target, compileRead(bind.readExpr, scope)))
	}

	for (const bind of options.classBinds ?? []) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!target) {
			if (ownsComponentMountRoot(options.root)) continue
			throw new Error(`[aero] Missing reactive class target: ${bind.selector}`)
		}
		cleanups.push(bindClassToggle(target, bind.className, compileRead(bind.readExpr, scope)))
	}

	for (const bind of options.propertyBinds ?? []) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!target) {
			if (ownsComponentMountRoot(options.root)) continue
			throw new Error(`[aero] Missing reactive property target: ${bind.selector}`)
		}
		cleanups.push(bindProperty(target, bind.propertyName, compileRead(bind.readExpr, scope)))
	}

	for (const bind of options.modelBinds ?? []) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (
			!(target instanceof HTMLInputElement) &&
			!(target instanceof HTMLTextAreaElement) &&
			!(target instanceof HTMLSelectElement)
		) {
			if (!target && ownsComponentMountRoot(options.root)) continue
			throw new Error(`[aero] Missing reactive model target: ${bind.selector}`)
		}
		const read = compileRead(bind.readExpr, scope)
		cleanups.push(
			bindFormModel({
				target,
				kind: bind.modelKind,
				read,
				write: value => {
					// eslint-disable-next-line @typescript-eslint/no-implied-eval
					new Function('scope', '$value', `with (scope) { ${bind.writeExpr} = $value; }`)(
						scope,
						value
					)
				},
				readonly: bind.readonly,
			})
		)
	}
}

function toKey(value: unknown): string | number {
	if (typeof value === 'string' || typeof value === 'number') return value
	throw new Error(`[aero] Loop key must be a string or number, got ${typeof value}.`)
}

/**
 * Wire compiled reactive text and base event handlers against a hydrated signal store.
 */
export function mountStateBindings(options: MountStateBindingsOptions): Cleanup {
	const scope =
		options.scope ??
		createStateScope({
			store: options.store,
			bindings: options.bindings,
			functionSources: options.functionSources,
			liveProps: options.liveProps,
			actionFunctions: options.hypermediaRuntime ? undefined : options.actionFunctions,
			scopeConstants: options.scopeConstants,
		})
	const cleanups: Cleanup[] = []

	for (const bind of options.textBinds) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!target) {
			if (ownsComponentMountRoot(options.root)) continue
			throw new Error(`[aero] Missing reactive text target: ${bind.selector}`)
		}
		cleanups.push(bindText(target, compileRead(bind.readExpr, scope, options.escapeHtml)))
	}

	for (const bind of options.eventBinds) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!target || typeof (target as Element).addEventListener !== 'function') {
			if (!target && ownsComponentMountRoot(options.root)) continue
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
			const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
			if (!isElementLike(target)) {
				if (ownsComponentMountRoot(options.root)) continue
				throw new Error(`[aero] Missing busy target: ${bind.selector}`)
			}
			cleanups.push(
				registerBusyBinding(target, bind.readExpr, options.store, options.bindings, options.hypermediaRuntime)
			)
		}
	}

	mountShowHtmlClassPropertyModel(options, scope, cleanups)

	for (const bind of options.ifBinds ?? []) {
		const anchor = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!anchor) {
			throw new Error(`[aero] Missing reactive if anchor: ${bind.selector}`)
		}
		cleanups.push(
			bindReactiveIf({
				anchor,
				scope,
				branches: bind.branches.map(branch => ({
					conditionExpr: branch.conditionExpr,
					renderHtml: () => branch.render(options.Aero),
					mountBranch: branchRoot => {
						const subsetCleanups = mountBindingSubset(branchRoot, scope, branch.mounts, options)
						return () => {
							for (const cleanup of subsetCleanups) cleanup()
						}
					},
				})),
			})
		)
	}

	for (const bind of options.forBinds ?? []) {
		const container = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!container) {
			throw new Error(`[aero] Missing reactive for container: ${bind.selector}`)
		}
		cleanups.push(
			bindKeyedFor({
				container,
				scope,
				itemsExpr: bind.itemsExpr,
				keyExpr: bind.keyExpr,
				binding: bind.binding,
				renderRow: rowScope => {
					const keyReader = compileScopeRead(bind.keyExpr, rowScope)
					return {
						key: toKey(keyReader()),
						renderHtml: () => bind.renderRow(options.Aero),
						mountRow: rowRoot => {
							const subsetCleanups = mountBindingSubset(rowRoot, rowScope, bind.rowMounts, options)
							return () => {
								for (const cleanup of subsetCleanups) cleanup()
							}
						},
					}
				},
			})
		)
	}

	for (const bind of options.componentBinds ?? []) {
		const target = queryBindTarget(options.root, bind.selector, options.componentBinds)
		if (!isElementLike(target)) {
			if (ownsComponentMountRoot(options.root) || !getComponentMount(bind.component)) continue
			throw new Error(`[aero] Missing reactive component target: ${bind.selector}`)
		}
		const mount = getComponentMount(bind.component)
		if (!mount) continue
		const childStore = new SignalStore()
		const cleanup = mount(target, options.Aero, {
			store: childStore,
			liveProps: resolveLivePropSignals(options.store, bind.livePropExprs),
		})
		cleanups.push(() => {
			if (typeof cleanup === 'function') cleanup()
			childStore.destroy()
		})
	}

	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}
