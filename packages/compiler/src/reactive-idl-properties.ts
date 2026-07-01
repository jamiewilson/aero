/** HTML attribute name → IDL property name for reactive property binds. */
export const REACTIVE_IDL_PROPERTIES: Readonly<Record<string, string>> = {
	disabled: 'disabled',
	readonly: 'readOnly',
	tabindex: 'tabIndex',
	hidden: 'hidden',
	indeterminate: 'indeterminate',
}

const BOOLEAN_IDL_PROPERTIES = new Set(['disabled', 'hidden', 'readOnly', 'indeterminate'])

export function bareAttributeName(name: string): string {
	return name.replace(/^aero-/, '').replace(/^data-aero-/, '')
}

export function isReactiveIdlPropertyAttribute(name: string): boolean {
	return bareAttributeName(name) in REACTIVE_IDL_PROPERTIES
}

export function idlPropertyNameForAttribute(name: string): string {
	const bare = bareAttributeName(name)
	return REACTIVE_IDL_PROPERTIES[bare] ?? bare
}

export function isBooleanIdlProperty(propertyName: string): boolean {
	return BOOLEAN_IDL_PROPERTIES.has(propertyName)
}
