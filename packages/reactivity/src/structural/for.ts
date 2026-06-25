import { Effect } from '../effect'
import type { Cleanup } from '../mount'
import { compileScopeRead } from '../scope-eval'
import type { StateScope } from '../state-scope'

export interface KeyedForRowSpec {
	readonly key: string | number
	readonly renderHtml: () => string
	readonly mountRow: (rowRoot: ParentNode) => Cleanup
}

export interface BindKeyedForOptions {
	readonly container: Element
	readonly scope: StateScope
	readonly itemsExpr: string
	readonly keyExpr: string
	readonly binding: string
	readonly renderRow: (rowScope: StateScope) => KeyedForRowSpec
}

function toKey(value: unknown): string | number {
	if (typeof value === 'string' || typeof value === 'number') return value
	throw new Error(`[aero] Loop key must be a string or number, got ${typeof value}.`)
}

function evalItems(itemsExpr: string, scope: StateScope): unknown[] {
	const value = compileScopeRead(itemsExpr, scope)()
	if (value == null) return []
	if (!Array.isArray(value)) {
		throw new Error('[aero] Reactive for loop iterable must be an array.')
	}
	return value
}

function evalKey(keyExpr: string, rowScope: StateScope): string | number {
	return toKey(compileScopeRead(keyExpr, rowScope)())
}

export function bindKeyedFor(options: BindKeyedForOptions): Cleanup {
	const { container, scope, itemsExpr, keyExpr, binding, renderRow } = options
	const rows = new Map<string | number, { element: Element; cleanup: Cleanup }>()
	const seenKeys = new Set<string | number>()

	const reconcile = (): void => {
		const items = evalItems(itemsExpr, scope)
		const doc = container.ownerDocument ?? globalThis.document
		seenKeys.clear()
		const nextKeys: Array<string | number> = []

		for (const item of items) {
			const rowScope = Object.create(scope) as StateScope
			Object.defineProperty(rowScope, binding, {
				configurable: true,
				enumerable: true,
				writable: true,
				value: item,
			})
			const key = evalKey(keyExpr, rowScope)
			if (seenKeys.has(key)) {
				throw new Error(`[aero] Duplicate loop key: ${String(key)}`)
			}
			seenKeys.add(key)
			nextKeys.push(key)

			const existing = rows.get(key)
			if (existing) continue

			const spec = renderRow(rowScope)
			const wrapper = doc.createElement('template')
			wrapper.innerHTML = spec.renderHtml().trim()
			const element = wrapper.content.firstElementChild
			if (!element) {
				throw new Error('[aero] Reactive for row render produced no element.')
			}
			const cleanup = spec.mountRow(element)
			rows.set(key, { element, cleanup })
		}

		for (const [key, row] of rows) {
			if (!seenKeys.has(key)) {
				row.cleanup()
				row.element.remove()
				rows.delete(key)
			}
		}

		const fragment = doc.createDocumentFragment()
		for (const key of nextKeys) {
			const row = rows.get(key)
			if (row) fragment.appendChild(row.element)
		}
		container.replaceChildren(fragment)
	}

	const effect = new Effect(reconcile)
	return () => {
		effect.destroy()
		for (const row of rows.values()) {
			row.cleanup()
			row.element.remove()
		}
		rows.clear()
	}
}
