export type AttributeCoercionResult = { action: 'set'; value: string } | { action: 'remove' }

function bareAttributeName(name: string): string {
	return name.replace(/^aero-/, '').replace(/^data-aero-/, '')
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

	if (bare.startsWith('data-')) {
		if (typeof value === 'boolean') {
			return value ? { action: 'set', value: '' } : { action: 'remove' }
		}
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
