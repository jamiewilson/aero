/**
 * General-purpose expression parsing utilities.
 */

/**
 * Extract top-level property keys from an object-literal expression string.
 *
 * @param expr - e.g. `{ title: expr, id: 42 }` or `{ config }` (shorthand).
 * @returns e.g. `['title', 'id']` or `['config']`. Does not support spread; callers must handle `...obj` separately.
 */
export function extractObjectKeys(expr: string): string[] {
	let inner = expr.trim()
	// Strip all matching outer braces (e.g. `{{ title }}` -> `title`)
	while (inner.startsWith('{') && inner.endsWith('}')) {
		inner = inner.slice(1, -1).trim()
	}

	if (!inner) return []

	const keys: string[] = []
	let depth = 0
	let current = ''

	for (let i = 0; i < inner.length; i++) {
		const char = inner[i]
		if (char === '{' || char === '[' || char === '(') {
			depth++
			current += char
		} else if (char === '}' || char === ']' || char === ')') {
			depth--
			current += char
		} else if (char === ',' && depth === 0) {
			// End of a property — extract the key
			const key = extractKeyFromEntry(current.trim())
			if (key) keys.push(key)
			current = ''
		} else {
			current += char
		}
	}

	// Handle the last entry
	const lastKey = extractKeyFromEntry(current.trim())
	if (lastKey) keys.push(lastKey)

	return keys
}

/** Extract key from one property entry: `key: value` → key, shorthand `ident` → ident; returns null for spread or invalid. */
function extractKeyFromEntry(entry: string): string | null {
	if (!entry) return null

	// Reject spread syntax
	if (entry.startsWith('...')) return null

	// Check for `key: value` pattern
	const colonIdx = entry.indexOf(':')
	if (colonIdx > 0) {
		return entry.slice(0, colonIdx).trim()
	}

	// Shorthand: bare identifier (e.g. `config`)
	if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(entry)) {
		return entry
	}

	return null
}
