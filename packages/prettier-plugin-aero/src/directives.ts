import {
	ATTR_CASE,
	ATTR_DEFAULT,
	ATTR_ELSE,
	ATTR_ELSE_IF,
	ATTR_FOR,
	ATTR_IF,
	ATTR_PREFIX,
	ATTR_PROPS,
	ATTR_SWITCH,
} from '@aero-js/compiler/constants'
import { isAttr } from '@aero-js/compiler/helpers'

/** Closed set of build directives that accept bare or data- prefixed names. */
export const BUILD_DIRECTIVES = [
	ATTR_IF,
	ATTR_ELSE_IF,
	ATTR_ELSE,
	ATTR_FOR,
	ATTR_SWITCH,
	ATTR_CASE,
	ATTR_DEFAULT,
	ATTR_PROPS,
] as const

export type BuildDirective = (typeof BUILD_DIRECTIVES)[number]

export function isBuildDirectiveName(name: string): name is BuildDirective {
	for (const directive of BUILD_DIRECTIVES) {
		if (isAttr(name, directive, ATTR_PREFIX)) return true
	}
	return false
}

/** Bare sugar applies only when the value is braced or boolean (else). */
export function isBuildDirectiveAttribute(name: string, rawValue: string): boolean {
	if (!isBuildDirectiveName(name)) return false
	const canonical = canonicalDirectiveName(name)
	if (canonical === ATTR_ELSE) return true
	const value = unwrapAttributeValue(rawValue)
	if (!value) return false
	const trimmed = value.trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}')
}

export function canonicalDirectiveName(name: string): BuildDirective {
	for (const directive of BUILD_DIRECTIVES) {
		if (isAttr(name, directive, ATTR_PREFIX)) return directive
	}
	throw new Error(`Not a build directive: ${name}`)
}

export function formatDirectiveName(directive: BuildDirective, usePrefix: boolean): string {
	return usePrefix ? `${ATTR_PREFIX}${directive}` : directive
}

/** Tags eligible for self-closing preference (*-component only, not *-layout). */
export function isSelfClosingComponentTag(tag: string | undefined): boolean {
	if (!tag) return false
	return tag.endsWith('-component')
}

export function unwrapAttributeValue(raw: string): string {
	const trimmed = raw.trim()
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1)
	}
	return trimmed
}

export function quoteAttributeValue(value: string, quote: '"' | "'"): string {
	const escaped = value.replaceAll(quote, quote === '"' ? '&quot;' : '&#39;')
	return `${quote}${escaped}${quote}`
}
