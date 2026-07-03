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
	readonly itemsExpr?: string
	readonly keyExpr?: string
	readonly items?: (scope: StateScope) => unknown[]
	readonly key?: (scope: StateScope) => string | number
	readonly binding: string
	readonly bindingNames: readonly string[]
	readonly destructureRow?: (item: unknown) => Record<string, unknown>
	readonly renderRow: (rowScope: StateScope) => KeyedForRowSpec
}

function toKey(value: unknown): string | number {
	if (typeof value === 'string' || typeof value === 'number') return value
	throw new Error(`[aero] Loop key must be a string or number, got ${typeof value}.`)
}

function normalizeIterable(value: unknown): unknown[] {
	if (value == null) return []
	if (Array.isArray(value)) return value
	if (value instanceof Set) return [...value]
	if (value instanceof Map) return [...value.entries()]
	if (typeof value === 'object' && value !== null && Symbol.iterator in value) {
		return [...(value as Iterable<unknown>)]
	}
	throw new Error(
		'[aero] Reactive for loop iterable must be an array, Set, Map, or other iterable value.'
	)
}

function evalItems(options: BindKeyedForOptions, scope: StateScope): unknown[] {
	const value = options.items
		? options.items(scope)
		: options.itemsExpr
			? compileScopeRead(options.itemsExpr, scope)()
			: undefined
	return normalizeIterable(value)
}

function evalKey(options: BindKeyedForOptions, rowScope: StateScope): string | number {
	const value = options.key
		? options.key(rowScope)
		: options.keyExpr
			? compileScopeRead(options.keyExpr, rowScope)()
			: undefined
	return toKey(value)
}

function createRowScope(
	parentScope: StateScope,
	options: Pick<BindKeyedForOptions, 'binding' | 'bindingNames' | 'destructureRow'>,
	item: unknown
): StateScope {
	const { binding, bindingNames, destructureRow } = options
	const rowScope = Object.create(parentScope) as StateScope
	const trimmed = binding.trim()
	if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
		rowScope[trimmed] = item
	} else if (destructureRow) {
		const values = destructureRow(item)
		for (const name of bindingNames) {
			rowScope[name] = values[name]
		}
	} else {
		const pairs = bindingNames.map(name => `${JSON.stringify(name)}: ${name}`).join(', ')
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const values = new Function('item', `const ${trimmed} = item; return ({ ${pairs} });`)(
			item
		) as Record<string, unknown>
		for (const name of bindingNames) {
			rowScope[name] = values[name]
		}
	}
	return rowScope
}

export function bindKeyedFor(options: BindKeyedForOptions): Cleanup {
	const { container, scope, binding, bindingNames, renderRow } = options
	const rows = new Map<string | number, { element: Element; cleanup: Cleanup }>()
	const seenKeys = new Set<string | number>()

	const reconcile = (): void => {
		const items = evalItems(options, scope)
		const doc = container.ownerDocument ?? globalThis.document
		seenKeys.clear()
		const nextKeys: Array<string | number> = []

		for (const item of items) {
			const rowScope = createRowScope(scope, { binding, bindingNames, destructureRow: options.destructureRow }, item)
			const key = evalKey(options, rowScope)
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
