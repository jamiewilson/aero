export type AttributeCoercionResult = { action: 'set'; value: string } | { action: 'remove' }

function bareAttributeName(name: string): string {
	return name.replace(/^aero-/, '').replace(/^data-aero-/, '')
}

/** Boolean flag attrs: data-* or any hyphenated name (e.g. is-even). Excludes aria-* (handled separately). */
function isBooleanPresenceAttribute(bare: string): boolean {
	return bare.startsWith('data-') || bare.includes('-')
}

/** Category-based attribute coercion for reactive attribute binds. */
export function coerceAttributeValue(name: string, value: unknown): AttributeCoercionResult {
	if (value === null || value === undefined) {
		return { action: 'remove' }
	}

	const bare = bareAttributeName(name)

	if (bare.startsWith('aria-')) {
		if (typeof value === 'boolean') {
			return { action: 'set', value: value ? 'true' : 'false' }
		}
		const str = String(value)
		return str === '' ? { action: 'remove' } : { action: 'set', value: str }
	}

	if (typeof value === 'boolean' && isBooleanPresenceAttribute(bare)) {
		return value ? { action: 'set', value: '' } : { action: 'remove' }
	}

	if (bare.startsWith('data-')) {
		const str = String(value)
		return str === '' ? { action: 'remove' } : { action: 'set', value: str }
	}

	const str = String(value)
	return str === '' ? { action: 'remove' } : { action: 'set', value: str }
}

export function applyAttributeCoercion(target: Element, name: string, value: unknown): void {
	const result = coerceAttributeValue(name, value)
	if (result.action === 'remove') {
		target.removeAttribute(name)
	} else {
		target.setAttribute(name, result.value)
	}
}

/** SSR/render helper: coerced attribute fragment with leading space, or empty when omitted. */
export function formatAttributeBind(
	name: string,
	value: unknown,
	escapeHtml?: (value: unknown) => string
): string {
	const result = coerceAttributeValue(name, value)
	if (result.action === 'remove') return ''
	const escape = escapeHtml ?? ((v: unknown) => String(v ?? ''))
	return ` ${name}="${escape(result.value)}"`
}
