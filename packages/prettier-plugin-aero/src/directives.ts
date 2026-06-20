export { formatBuildDirectiveName } from '@aero-js/compiler/build-directive-attributes'

/** Tags eligible for self-closing preference (*-component only, not *-layout). */
export function isSelfClosingComponentTag(tag: string | undefined): boolean {
	if (!tag) return false
	return tag.endsWith('-component')
}

export function quoteAttributeValue(value: string, quote: '"' | "'"): string {
	const escaped = value.replaceAll(quote, quote === '"' ? '&quot;' : '&#39;')
	return `${quote}${escaped}${quote}`
}
