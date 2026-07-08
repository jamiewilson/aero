import { Effect } from '../effect'
import type { Cleanup, RowMountResult } from '../mount'
import { compileScopeRead } from '../scope-eval'
import type { StateScope } from '../state-scope'
import {
	type MountTarget,
	replaceMountTargetChildren,
} from './anchor'

export interface KeyedForRowSpec {
	readonly key: string | number
	readonly renderHtml: () => string
	readonly mountRow: (rowRoot: ParentNode) => RowMountResult
}

export interface BindKeyedForOptions {
	readonly mountTarget: MountTarget
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

function applyRowBinding(
	rowScope: StateScope,
	options: Pick<BindKeyedForOptions, 'binding' | 'bindingNames' | 'destructureRow'>,
	item: unknown
): void {
	const { binding, bindingNames, destructureRow } = options
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
}

function applyLoopMetadata(rowScope: StateScope, index: number, length: number): void {
	rowScope.index = index
	rowScope.first = index === 0
	rowScope.last = index === length - 1
	rowScope.length = length
}

function createRowScope(
	parentScope: StateScope,
	options: Pick<BindKeyedForOptions, 'binding' | 'bindingNames' | 'destructureRow'>,
	item: unknown,
	index: number,
	length: number
): StateScope {
	const rowScope = Object.create(parentScope) as StateScope
	applyRowBinding(rowScope, options, item)
	applyLoopMetadata(rowScope, index, length)
	return rowScope
}

function updateRowScope(
	rowScope: StateScope,
	options: Pick<BindKeyedForOptions, 'binding' | 'bindingNames' | 'destructureRow'>,
	item: unknown,
	index: number,
	length: number
): void {
	applyRowBinding(rowScope, options, item)
	applyLoopMetadata(rowScope, index, length)
}

function resolveRowMount(mounted: RowMountResult): { cleanup: Cleanup; refresh: () => void } {
	if (typeof mounted === 'function') {
		return { cleanup: mounted, refresh: () => {} }
	}
	return { cleanup: mounted.cleanup, refresh: mounted.refresh ?? (() => {}) }
}

export function bindKeyedFor(options: BindKeyedForOptions): Cleanup {
	const { mountTarget, scope, binding, bindingNames, renderRow } = options
	const rows = new Map<
		string | number,
		{ element: Element; cleanup: Cleanup; rowScope: StateScope; refresh: () => void }
	>()
	const seenKeys = new Set<string | number>()

	const reconcile = (): void => {
		const items = evalItems(options, scope)
		const doc =
			(mountTarget.kind === 'element'
				? mountTarget.element.ownerDocument
				: (mountTarget.range.parent as Node).ownerDocument) ?? globalThis.document
		seenKeys.clear()
		const nextKeys: Array<string | number> = []

		for (let index = 0; index < items.length; index++) {
			const item = items[index]!
			const key = (() => {
				const probeScope = createRowScope(
					scope,
					{ binding, bindingNames, destructureRow: options.destructureRow },
					item,
					index,
					items.length
				)
				return evalKey(options, probeScope)
			})()
			if (seenKeys.has(key)) {
				throw new Error(`[aero] Duplicate loop key: ${String(key)}`)
			}
			seenKeys.add(key)
			nextKeys.push(key)

			const existing = rows.get(key)
			if (existing) {
				updateRowScope(
					existing.rowScope,
					{ binding, bindingNames, destructureRow: options.destructureRow },
					item,
					index,
					items.length
				)
				continue
			}

			const rowScope = createRowScope(
				scope,
				{ binding, bindingNames, destructureRow: options.destructureRow },
				item,
				index,
				items.length
			)
			const spec = renderRow(rowScope)
			const wrapper = doc.createElement('template')
			wrapper.innerHTML = spec.renderHtml().trim()
			const element = wrapper.content.firstElementChild
			if (!element) {
				throw new Error('[aero] Reactive for row render produced no element.')
			}
			const { cleanup, refresh } = resolveRowMount(spec.mountRow(element))
			rows.set(key, { element, cleanup, rowScope, refresh })
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
		replaceMountTargetChildren(mountTarget, fragment)

		for (const key of nextKeys) {
			const row = rows.get(key)
			if (!row) continue
			row.refresh()
		}
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
