import { Computed } from './computed'
import { Signal } from './signal'

type SignalLike<T = unknown> = { value: T }
type StoreEntry = Signal<unknown> | Computed<unknown> | SignalLike

function flattenObject(
	value: Record<string, unknown>,
	prefix = '',
	out: Record<string, unknown> = {}
): Record<string, unknown> {
	for (const [k, v] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${k}` : k
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			flattenObject(v as Record<string, unknown>, path, out)
		} else {
			out[path] = v
		}
	}
	return out
}

function assignNested(out: Record<string, unknown>, path: string, value: unknown): void {
	const parts = path.split('.')
	let cursor: Record<string, unknown> = out
	for (let i = 0; i < parts.length - 1; i++) {
		const key = parts[i]
		const current = cursor[key]
		if (!current || typeof current !== 'object' || Array.isArray(current)) {
			cursor[key] = {}
		}
		cursor = cursor[key] as Record<string, unknown>
	}
	cursor[parts[parts.length - 1]] = value
}

export class SignalStore {
	private entries = new Map<string, StoreEntry>()

	signal<T>(path: string, initial?: T): Signal<T> {
		const existing = this.entries.get(path)
		if (existing) {
			if (existing instanceof Signal) return existing as Signal<T>
			throw new Error(`[aero] Path ${JSON.stringify(path)} already registered.`)
		}
		const created = new Signal<T>(initial as T)
		this.entries.set(path, created as Signal<unknown>)
		return created
	}

	computed<T>(path: string, fn: () => T): Computed<T> {
		const existing = this.entries.get(path)
		if (existing) {
			if (existing instanceof Computed) return existing as Computed<T>
			throw new Error(`[aero] Path ${JSON.stringify(path)} already registered.`)
		}
		const created = new Computed<T>(fn)
		this.entries.set(path, created as Computed<unknown>)
		return created
	}

	alias<T>(path: string, entry: SignalLike<T>): SignalLike<T> {
		const existing = this.entries.get(path)
		if (existing && existing !== entry) {
			throw new Error(`[aero] Path ${JSON.stringify(path)} already registered.`)
		}
		this.entries.set(path, entry as StoreEntry)
		return entry
	}

	get<T>(path: string): Signal<T> | Computed<T> | SignalLike<T> {
		const entry = this.entries.get(path)
		if (!entry) {
			throw new Error(`[aero] Missing signal path: ${JSON.stringify(path)}`)
		}
		return entry as Signal<T> | Computed<T> | SignalLike<T>
	}

	has(path: string): boolean {
		return this.entries.has(path)
	}

	merge(values: Record<string, unknown>): void {
		const flat = flattenObject(values)
		for (const [path, value] of Object.entries(flat)) {
			const existing = this.entries.get(path)
			if (existing && !(existing instanceof Computed)) {
				existing.value = value
				continue
			}
			if (existing && existing instanceof Computed) {
				throw new Error(`[aero] Cannot merge into computed path: ${JSON.stringify(path)}`)
			}
			this.signal(path, value)
		}
	}

	evaluate(expr: string): unknown {
		const code = expr.replace(/\$(\w+(?:\.\w+)*)/g, (_, path: string) => {
			return `store.get(${JSON.stringify(path)}).value`
		})
		return new Function('store', `return (${code})`)(this)
	}

	snapshot(): Record<string, unknown> {
		const out: Record<string, unknown> = {}
		for (const [path, entry] of this.entries.entries()) {
			assignNested(out, path, entry.value)
		}
		return out
	}

	destroy(): void {
		for (const entry of this.entries.values()) {
			if (entry instanceof Computed) entry.destroy()
		}
		this.entries.clear()
	}
}
