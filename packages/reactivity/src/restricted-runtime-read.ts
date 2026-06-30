import { SignalStore } from './store'

const STORE_REF_RE = /^\$(\w+(?:\.\w+)*)$/

/** `$path` or `$path.nested` store reference accepted by restricted `process()`. */
export function parseRestrictedStoreRef(expr: string): string | null {
	const match = STORE_REF_RE.exec(expr.trim())
	return match ? match[1]! : null
}

function readStorePath(store: SignalStore, path: string): unknown {
	return store.get(path).value
}

function isQuotedStringLiteral(expr: string): boolean {
	const trimmed = expr.trim()
	return (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	)
}

/** Eval-free reader for restricted `process()` — `$path` refs only. */
export function compileRestrictedRead(expr: string, store: SignalStore): () => unknown {
	const path = parseRestrictedStoreRef(expr)
	if (path) return () => readStorePath(store, path)
	throw new Error(
		`[aero] Restricted process() only supports $store references (e.g. $count). Got: ${JSON.stringify(expr)}`
	)
}

/** Structural condition: `$path` or string literal. */
export function compileRestrictedCondition(expr: string, store: SignalStore): () => unknown {
	const trimmed = expr.trim()
	const path = parseRestrictedStoreRef(trimmed)
	if (path) return () => readStorePath(store, path)
	if (isQuotedStringLiteral(trimmed)) {
		return () => JSON.parse(trimmed.replace(/^'|'$/g, '"'))
	}
	throw new Error(
		`[aero] Restricted process() structural conditions must be $store refs or string literals. Got: ${JSON.stringify(expr)}`
	)
}

/** Structural iterable: `$path` to array only. */
export function compileRestrictedIterable(expr: string, store: SignalStore): () => unknown {
	const path = parseRestrictedStoreRef(expr)
	if (!path) {
		throw new Error(
			`[aero] Restricted process() for loops require a $store array reference. Got: ${JSON.stringify(expr)}`
		)
	}
	return () => {
		const value = readStorePath(store, path)
		if (value == null) return []
		if (!Array.isArray(value)) {
			throw new Error('[aero] Reactive for loop iterable must be an array.')
		}
		return value
	}
}

/** Row key in restricted for loops: bare identifier path segment on row scope. */
export function compileRestrictedRowKey(expr: string, rowScope: Record<string, unknown>): () => unknown {
	const trimmed = expr.trim()
	const path = parseRestrictedStoreRef(trimmed)
	if (path) {
		const segment = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : path
		return () => rowScope[segment]
	}
	if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
		return () => rowScope[trimmed]
	}
	throw new Error(
		`[aero] Restricted process() for keys must be $path refs or row binding names. Got: ${JSON.stringify(expr)}`
	)
}
