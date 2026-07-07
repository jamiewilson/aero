/** IDL property name → HTML content attribute to mirror (null = no content attribute). */
const IDL_TO_CONTENT_ATTRIBUTE: Readonly<Record<string, string | null>> = {
	disabled: 'disabled',
	readOnly: 'readonly',
	tabIndex: 'tabindex',
	hidden: 'hidden',
	indeterminate: null,
}

const BOOLEAN_IDL_PROPERTIES = new Set(['disabled', 'hidden', 'readOnly', 'indeterminate'])

export function shouldMirrorContentAttribute(propertyName: string): string | null {
	if (Object.prototype.hasOwnProperty.call(IDL_TO_CONTENT_ATTRIBUTE, propertyName)) {
		return IDL_TO_CONTENT_ATTRIBUTE[propertyName] ?? null
	}
	return null
}

export function isBooleanIdlPropertyForMirror(propertyName: string): boolean {
	return BOOLEAN_IDL_PROPERTIES.has(propertyName) && propertyName !== 'indeterminate'
}

export function mirrorBooleanPresenceAttr(target: Element, name: string, active: boolean): void {
	if (active) {
		if (!target.hasAttribute(name)) target.setAttribute(name, '')
	} else if (target.hasAttribute(name)) {
		target.removeAttribute(name)
	}
}

export function mirrorStringAttr(
	target: Element,
	name: string,
	value: string | null | undefined
): void {
	const next = value == null ? '' : String(value)
	if (next === '') {
		if (target.hasAttribute(name)) target.removeAttribute(name)
		return
	}
	if (target.getAttribute(name) !== next) target.setAttribute(name, next)
}
