import { SignalStore } from './store'
import { bindText, bindEvent, type Cleanup } from './mount'
import { bindShow } from './bindings/show'
import { bindHtml } from './bindings/html'
import { bindClassToggle } from './bindings/class'
import { bindProperty } from './bindings/property'
import { bindFormModel, type FormModelKind } from './bindings/model'
import { bindReactiveIf, type ReactiveIfBranchSpec } from './structural/if'
import { bindKeyedFor } from './structural/for'
import { bindReactiveSwitch } from './structural/switch'
import { createStateScope, type StateScope } from './state-scope'
import { compileRuntimeRead, wireAdoptStructuralBindings } from './adopt-structural'

export interface BindingHandler {
	readonly name: string
	setup(el: Element, params: { expression: string | null; store: SignalStore; scope: StateScope }): Cleanup | void
}

function stripBraces(value: string): string {
	const trimmed = value.trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}')
		? trimmed.slice(1, -1).trim()
		: trimmed
}

function compileRuntimeHandler(expr: string, store: SignalStore): (this: Element, event: Event) => void {
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

export function createDefaultHandlers(): BindingHandler[] {
	return [
		{
			name: 'text',
			setup(el, { expression, store }) {
				if (!expression) return
				return bindText(el, compileRuntimeRead(expression, store))
			},
		},
		{
			name: 'html',
			setup(el, { expression, store }) {
				if (!expression) return
				return bindHtml(el, compileRuntimeRead(expression, store))
			},
		},
		{
			name: 'show',
			setup(el, { expression, store }) {
				if (!expression || !(el instanceof HTMLElement)) return
				const original = el.style.display
				return bindShow(el, compileRuntimeRead(expression, store), original)
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
					compileRuntimeHandler(params.expression, params.store),
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
				const read = compileRuntimeRead(expr, params.store)
				const write = (value: unknown) => {
					const path = stripBraces(expr).replace(/^\$/, '')
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
				return bindProperty(el, propName, compileRuntimeRead(params.expression, params.store))
			},
		},
	]
}

export interface AdoptOptions {
	readonly container: ParentNode
	readonly store?: SignalStore
	readonly handlers?: readonly BindingHandler[]
}

const STRUCTURAL_ADOPTED_SELECTOR =
	'[data-aero-adopted][data-aero-switch], [data-aero-adopted][data-aero-if], [data-aero-adopted][data-aero-for]'

function isInsideStructuralAdoptedSubtree(el: Element, container: ParentNode): boolean {
	if (el === container) return false
	if (typeof el.closest !== 'function') return false
	return Boolean(el.closest(STRUCTURAL_ADOPTED_SELECTOR))
}

export function adoptFragment(options: AdoptOptions): Cleanup {
	const store = options.store ?? new SignalStore()
	const scope = createStateScope({ store, bindings: [], functionSources: [] })
	const handlers = options.handlers ?? createDefaultHandlers()
	const cleanups: Cleanup[] = []

	const adoptNested = (nested: ParentNode): Cleanup =>
		adoptFragment({ container: nested, store, handlers })

	cleanups.push(
		...wireAdoptStructuralBindings({
			container: options.container,
			store,
			adoptNested,
		})
	)

	const elements = options.container.querySelectorAll?.('*') ?? []

	for (const el of elements) {
		if (el.hasAttribute('data-aero-adopted')) continue
		if (isInsideStructuralAdoptedSubtree(el as Element, options.container)) continue
		let adopted = false

		for (let i = 0; i < el.attributes.length; i++) {
			const attr = el.attributes[i]!
			const name = attr.name

			if (name === 'data-aero-text' && attr.value) {
				const expr = el.getAttribute('data-aero-text-expr') ?? attr.value
				const cleanup = handlers.find(h => h.name === 'text')?.setup(el, {
					expression: expr.startsWith('$') ? expr : `$${expr}`,
					store,
					scope,
				})
				if (cleanup) cleanups.push(cleanup)
				adopted = true
			}

			if (name === 'data-aero-html' && attr.value) {
				const expr = el.getAttribute('data-aero-html-expr') ?? attr.value
				const cleanup = handlers.find(h => h.name === 'html')?.setup(el, {
					expression: expr,
					store,
					scope,
				})
				if (cleanup) cleanups.push(cleanup)
				adopted = true
			}

			if (name === 'data-aero-show' && attr.value) {
				const cleanup = handlers.find(h => h.name === 'show')?.setup(el, {
					expression: attr.value,
					store,
					scope,
				})
				if (cleanup) cleanups.push(cleanup)
				adopted = true
			}

			if (name.startsWith('data-aero-class-')) {
				const className = name.slice('data-aero-class-'.length)
				const expr = attr.value
				const cleanup = bindClassToggle(
					el,
					className,
					compileRuntimeRead(expr || '$true', store)
				)
				cleanups.push(cleanup)
				adopted = true
			}

			if (name.startsWith('data-aero-on-') && attr.value) {
				const cleanup = handlers.find(h => h.name === 'on')?.setup(el, {
					expression: attr.value,
					store,
					scope,
					attrName: name,
				} as never)
				if (cleanup) cleanups.push(cleanup)
				adopted = true
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
				adopted = true
			}
		}

		if (adopted) el.setAttribute('data-aero-adopted', '')
	}

	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}

export class AeroReactivity {
	readonly store: SignalStore
	private rootCleanups: Cleanup[] = []

	constructor(store?: SignalStore) {
		this.store = store ?? new SignalStore()
	}

	adopt(container: ParentNode, store?: SignalStore): Cleanup {
		const cleanup = adoptFragment({ container, store: store ?? this.store })
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
