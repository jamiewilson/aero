import { SignalStore } from './store'
import { bindText, bindEvent, type Cleanup } from './mount'
import { bindShow } from './bindings/show'
import { bindHtml } from './bindings/html'
import { bindClassToggle } from './bindings/class'
import { bindProperty } from './bindings/property'
import { bindFormModel, type FormModelKind } from './bindings/model'
import { createStateScope, type StateScope } from './state-scope'
import {
	compileRestrictedRuntimeRead,
	compileUnsafeRuntimeRead,
	type RuntimeReadCompiler,
	wireProcessStructuralBindings,
	isCompiledBindMarker,
} from './process-structural'
import { parseRestrictedStoreRef } from './restricted-runtime-read'
import { stripBraces } from '@aero-js/interpolation'

export interface BindingHandler {
	readonly name: string
	setup(el: Element, params: { expression: string | null; store: SignalStore; scope: StateScope }): Cleanup | void
}

/** @internal Eval-based handler for unsafeProcessFragment only. */
function compileUnsafeRuntimeHandler(expr: string, store: SignalStore): (this: Element, event: Event) => void {
	const code = expr.replace(/\$(\w+(?:\.\w+)*)/g, (_, path: string) => {
		return `store.get(${JSON.stringify(path)}).value`
	})
	const body = code.trim().endsWith(';') ? code.trim() : `${code.trim()};`
	// eslint-disable-next-line @typescript-eslint/no-implied-eval
	return new Function('store', 'event', `return function() { ${body} }`)(store, undefined) as (
		this: Element,
		event: Event
	) => void
}

const HYPERMEDIA_ACTION_RE =
	/^(POST|GET|PUT|PATCH|DELETE)\s*\(\s*(['"])([^'"]*)\2\s*(?:,\s*\{[^}]*\})?\s*\)$/

function isHypermediaActionExpression(expr: string): boolean {
	return HYPERMEDIA_ACTION_RE.test(stripBraces(expr).trim())
}

function compileRestrictedRuntimeHandler(expr: string): (this: Element, event: Event) => void {
	const inner = stripBraces(expr).trim()
	if (isHypermediaActionExpression(inner)) {
		return function () {}
	}
	throw new Error(
		`[aero] Restricted process() event handlers must use hypermedia action grammar (e.g. GET('/path')). Got: ${JSON.stringify(expr)}`
	)
}

function getEventName(attrName: string): string {
	const bare = attrName.startsWith('data-aero-on-') ? attrName.slice('data-aero-on-'.length) : attrName
	return bare.split('-')[0] ?? 'click'
}

function getModifiers(attrName: string): string[] {
	if (!attrName.startsWith('data-aero-on-')) return []
	const rest = attrName.slice('data-aero-on-'.length)
	const parts = rest.split('-')
	return parts.slice(1)
}

function inferFormModelKind(el: Element, attrName: string): FormModelKind | null {
	const bare = attrName.replace(/^data-aero-/, '').replace(/^aero-/, '')
	if (bare === 'value' || bare.startsWith('value-')) return 'value'
	if (bare === 'checked' || bare.startsWith('checked-')) return 'checked'
	if (attrName === 'value' && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
		return 'value'
	}
	if (attrName === 'checked' && el instanceof HTMLInputElement) return 'checked'
	return null
}

function isReadonlyFormAttr(attrName: string): boolean {
	return attrName.includes('readonly') || attrName.endsWith('-readonly')
}

export function createDefaultHandlers(options?: {
	readonly compileRead?: RuntimeReadCompiler
	readonly compileHandler?: (expr: string, store: SignalStore) => (this: Element, event: Event) => void
}): BindingHandler[] {
	const compileRead = options?.compileRead ?? compileRestrictedRuntimeRead
	const compileHandler =
		options?.compileHandler ??
		((expr: string, _store: SignalStore) => compileRestrictedRuntimeHandler(expr))
	return [
		{
			name: 'text',
			setup(el, { expression, store }) {
				if (!expression) return
				return bindText(el, compileRead(expression, store))
			},
		},
		{
			name: 'html',
			setup(el, { expression, store }) {
				if (!expression) return
				return bindHtml(el, compileRead(expression, store))
			},
		},
		{
			name: 'show',
			setup(el, { expression, store }) {
				if (!expression || !(el instanceof HTMLElement)) return
				const original = el.style.display
				return bindShow(el, compileRead(expression, store), original)
			},
		},
		{
			name: 'class',
			setup(el, { expression, store }) {
				if (!expression) return
				const className = expression
				return bindClassToggle(el, className, () => true)
			},
		},
		{
			name: 'on',
			setup(el, params) {
				const attr = (params as { attrName?: string }).attrName
				if (!attr || !params.expression) return
				return bindEvent(
					el,
					getEventName(attr),
					compileHandler(params.expression, params.store),
					getModifiers(attr)
				)
			},
		},
		{
			name: 'model',
			setup(el, params) {
				const attrName = (params as { attrName?: string }).attrName ?? ''
				const kind = inferFormModelKind(el, attrName)
				if (!kind || !params.expression) return
				if (
					!(el instanceof HTMLInputElement) &&
					!(el instanceof HTMLTextAreaElement) &&
					!(el instanceof HTMLSelectElement)
				) {
					return
				}
				const expr = params.expression
				const path = parseRestrictedStoreRef(stripBraces(expr))
				if (!path) {
					throw new Error(
						`[aero] Restricted process() model bindings require $store refs. Got: ${JSON.stringify(expr)}`
					)
				}
				const read = compileRead(`$${path}`, params.store)
				const write = (value: unknown) => {
					;(params.store.get(path) as { value: unknown }).value = value
				}
				return bindFormModel({
					target: el,
					kind,
					read,
					write,
					readonly: isReadonlyFormAttr(attrName),
				})
			},
		},
		{
			name: 'property',
			setup(el, params) {
				const propName = (params as { propertyName?: string }).propertyName
				if (!propName || !params.expression) return
				return bindProperty(el, propName, compileRead(params.expression, params.store))
			},
		},
	]
}

export interface ProcessOptions {
	readonly element: ParentNode
	readonly store?: SignalStore
	readonly handlers?: readonly BindingHandler[]
}

const STRUCTURAL_PROCESSED_SELECTOR =
	'[data-aero-processed][data-aero-switch], [data-aero-processed][data-aero-if], [data-aero-processed][data-aero-for]'

function isInsideStructuralProcessedSubtree(el: Element, element: ParentNode): boolean {
	if (el === element) return false
	if (typeof el.closest !== 'function') return false
	return Boolean(el.closest(STRUCTURAL_PROCESSED_SELECTOR))
}

function runProcessFragment(
	options: ProcessOptions,
	runtime: { compileRead: RuntimeReadCompiler; compileHandler: (expr: string, store: SignalStore) => (this: Element, event: Event) => void }
): Cleanup {
	const store = options.store ?? new SignalStore()
	const scope = createStateScope({ store, bindings: [], functionSources: [] })
	const handlers = options.handlers ?? createDefaultHandlers({
		compileRead: runtime.compileRead,
		compileHandler: runtime.compileHandler,
	})
	const cleanups: Cleanup[] = []

	const processNested = (nested: ParentNode): Cleanup =>
		runProcessFragment({ element: nested, store, handlers }, runtime)

	cleanups.push(
		...wireProcessStructuralBindings({
			element: options.element,
			store,
			processNested,
			compileRead: runtime.compileRead,
		})
	)

	const elements = options.element.querySelectorAll?.('*') ?? []

	for (const el of elements) {
		if (el.hasAttribute('data-aero-processed')) continue
		if (isInsideStructuralProcessedSubtree(el as Element, options.element)) continue
		let processed = false

		for (let i = 0; i < el.attributes.length; i++) {
			const attr = el.attributes[i]!
			const name = attr.name

			if (name === 'data-aero-text' && attr.value) {
				if (isCompiledBindMarker(attr.value) && !el.hasAttribute('data-aero-text-expr')) continue
				const expr = el.getAttribute('data-aero-text-expr') ?? attr.value
				const cleanup = handlers.find(h => h.name === 'text')?.setup(el, {
					expression: expr.startsWith('$') ? expr : `$${expr}`,
					store,
					scope,
				})
				if (cleanup) cleanups.push(cleanup)
				processed = true
			}

			if (name === 'data-aero-html' && attr.value) {
				const expr = el.getAttribute('data-aero-html-expr') ?? attr.value
				const cleanup = handlers.find(h => h.name === 'html')?.setup(el, {
					expression: expr,
					store,
					scope,
				})
				if (cleanup) cleanups.push(cleanup)
				processed = true
			}

			if (name === 'data-aero-show' && attr.value) {
				const cleanup = handlers.find(h => h.name === 'show')?.setup(el, {
					expression: attr.value,
					store,
					scope,
				})
				if (cleanup) cleanups.push(cleanup)
				processed = true
			}

			if (name.startsWith('data-aero-class-')) {
				const className = name.slice('data-aero-class-'.length)
				const expr = attr.value
				const cleanup = bindClassToggle(
					el,
					className,
					runtime.compileRead(expr || '$true', store)
				)
				cleanups.push(cleanup)
				processed = true
			}

			if (name.startsWith('data-aero-on-') && attr.value) {
				const cleanup = handlers.find(h => h.name === 'on')?.setup(el, {
					expression: attr.value,
					store,
					scope,
					attrName: name,
				} as never)
				if (cleanup) cleanups.push(cleanup)
				processed = true
			}

			const modelKind = inferFormModelKind(el, name)
			if (modelKind && attr.value && attr.value.includes('$')) {
				const cleanup = handlers.find(h => h.name === 'model')?.setup(el, {
					expression: stripBraces(attr.value),
					store,
					scope,
					attrName: name,
				} as never)
				if (cleanup) cleanups.push(cleanup)
				processed = true
			}
		}

		if (processed) el.setAttribute('data-aero-processed', '')
	}

	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}

/** Eval-free runtime wiring for swapped HTML fragments. */
export function processFragment(options: ProcessOptions): Cleanup {
	return runProcessFragment(options, {
		compileRead: compileRestrictedRuntimeRead,
		compileHandler: (expr, _store) => compileRestrictedRuntimeHandler(expr),
	})
}

/**
 * Trusted content only. Requires `unsafe-eval` CSP. Not used by hypermedia swaps.
 * Supports arbitrary `{ expr }` in runtime directive attributes.
 */
export function unsafeProcessFragment(options: ProcessOptions): Cleanup {
	return runProcessFragment(options, {
		compileRead: compileUnsafeRuntimeRead,
		compileHandler: compileUnsafeRuntimeHandler,
	})
}

export class AeroReactivity {
	readonly store: SignalStore
	private rootCleanups: Cleanup[] = []

	constructor(store?: SignalStore) {
		this.store = store ?? new SignalStore()
	}

	process(element: ParentNode, store?: SignalStore): Cleanup {
		const cleanup = processFragment({ element, store: store ?? this.store })
		this.rootCleanups.push(cleanup)
		return cleanup
	}

	destroy(): void {
		for (const cleanup of this.rootCleanups) cleanup()
		this.rootCleanups = []
		this.store.destroy()
	}
}

export { bindReactiveIf, bindKeyedFor, bindReactiveSwitch, type ReactiveIfBranchSpec }
