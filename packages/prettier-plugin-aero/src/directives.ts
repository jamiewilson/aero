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

/**
 * Tags where a bare directive name is actually a native HTML attribute (`<label for>`,
 * `<input switch>`, `<track default>`). On these the bare name must be left alone — never
 * prefix-rewritten — because `data-default` ≠ `default`. The `data-` form is always a directive.
 */
const NATIVE_BARE_ATTR_TAGS: Record<string, ReadonlySet<string>> = {
	[ATTR_FOR]: new Set(['label', 'output']),
	[ATTR_SWITCH]: new Set(['input']),
	[ATTR_DEFAULT]: new Set(['track']),
}

/**
 * True when an attribute should be treated as a native HTML attribute (not an Aero directive) for
 * the given tag: a bare directive name whose value is not brace-shaped, on a tag where that name is
 * genuinely native.
 */
export function isNativeBareAttribute(
	tag: string | undefined,
	name: string,
	rawValue: string
): boolean {
	if (!tag) return false
	const value = unwrapAttributeValue(rawValue).trim()
	if (value.startsWith('{') && value.endsWith('}')) return false
	return NATIVE_BARE_ATTR_TAGS[name]?.has(tag.toLowerCase()) ?? false
}

export function isBuildDirectiveName(name: string): name is BuildDirective {
	for (const directive of BUILD_DIRECTIVES) {
		if (isAttr(name, directive, ATTR_PREFIX)) return true
	}
	return false
}

/** Bare sugar: braced values, string `case`, boolean `else`/`default`, bare `props`. */
export function isBuildDirectiveAttribute(name: string, rawValue: string): boolean {
	if (!isBuildDirectiveName(name)) return false
	const canonical = canonicalDirectiveName(name)
	if (canonical === ATTR_ELSE || canonical === ATTR_DEFAULT) return true
	const value = unwrapAttributeValue(rawValue)
	const trimmed = value.trim()
	if (canonical === ATTR_PROPS && !trimmed) return true
	if (canonical === ATTR_FOR) {
		return trimmed.startsWith('{') && trimmed.endsWith('}')
	}
	if (canonical === ATTR_CASE) return trimmed.length > 0
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
