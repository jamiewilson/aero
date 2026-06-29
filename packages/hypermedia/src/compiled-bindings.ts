const COMPILED_MARKER_ATTRS = [
	'data-aero-text',
	'data-aero-event',
	'data-aero-show',
	'data-aero-busy',
	'data-aero-html',
	'data-aero-if',
	'data-aero-for',
	'data-aero-switch',
] as const

export function isCompiledBindMarker(value: string | null): boolean {
	return value != null && /^\d+$/.test(value.trim())
}

function elementHasCompiledMarker(element: Element): boolean {
	for (const attr of element.getAttributeNames()) {
		if (attr.startsWith('data-aero-model-') && isCompiledBindMarker(element.getAttribute(attr))) {
			return true
		}
		if ((COMPILED_MARKER_ATTRS as readonly string[]).includes(attr)) {
			if (isCompiledBindMarker(element.getAttribute(attr))) return true
		}
	}
	return false
}

/** True when the element or its descendants use compiler-emitted reactive bind ids. */
export function hasCompiledBindSubtree(element: Element): boolean {
	if (elementHasCompiledMarker(element)) return true
	const selector = [
		...COMPILED_MARKER_ATTRS.map(name => `[${name}]`),
		'[data-aero-model-value]',
		'[data-aero-model-checked]',
	].join(',')
	for (const node of element.querySelectorAll(selector)) {
		if (elementHasCompiledMarker(node)) return true
	}
	return false
}
