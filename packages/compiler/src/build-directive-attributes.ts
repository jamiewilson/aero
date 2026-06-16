/**
 * Single source of truth for Aero build-time directive attribute classification.
 *
 * Used by the compiler lowerer, prettier plugin, and VSCode diagnostics so native HTML
 * collision rules and braced-value requirements stay in sync.
 */

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
} from './constants'
import { isAttr } from './helpers'

/** Closed set of build directives that accept bare or `data-` prefixed names. */
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
 * Elements on which a bare directive name is actually a real HTML attribute. A bare `for` is the
 * native attribute on `<label>`/`<output>`, `switch` on `<input>` (Safari toggle), `default` on
 * `<track>`. The `data-` form is always an explicit directive.
 */
export const NATIVE_BARE_ATTR_ELEMENTS: Record<BuildDirective, ReadonlySet<string>> = {
	[ATTR_IF]: new Set(),
	[ATTR_ELSE_IF]: new Set(),
	[ATTR_ELSE]: new Set(),
	[ATTR_FOR]: new Set(['label', 'output']),
	[ATTR_SWITCH]: new Set(['input']),
	[ATTR_CASE]: new Set(),
	[ATTR_DEFAULT]: new Set(['track']),
	[ATTR_PROPS]: new Set(),
}

/** Directives whose values must be a single brace-wrapped expression (when treated as a directive). */
const BRACED_VALUE_DIRECTIVES = new Set<BuildDirective>([
	ATTR_IF,
	ATTR_ELSE_IF,
	ATTR_FOR,
	ATTR_PROPS,
])

/** Strip optional quote wrappers from parser or DOM attribute values. */
export function normalizeAttributeValue(raw: string | null | undefined): string {
	if (raw == null) return ''
	const trimmed = raw.trim()
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1)
	}
	return trimmed
}

/** A value is directive-shaped when it is a single brace-wrapped expression, e.g. `{ expr }`. */
export function looksBracedDirectiveValue(value: string | null | undefined): boolean {
	if (value == null) return false
	const trimmed = normalizeAttributeValue(value).trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}')
}

export function isBuildDirectiveName(name: string): boolean {
	for (const directive of BUILD_DIRECTIVES) {
		if (isAttr(name, directive, ATTR_PREFIX)) return true
	}
	return false
}

export function canonicalBuildDirectiveName(name: string): BuildDirective {
	for (const directive of BUILD_DIRECTIVES) {
		if (isAttr(name, directive, ATTR_PREFIX)) return directive
	}
	throw new Error(`Not a build directive: ${name}`)
}

/**
 * True when a bare (non-`data-`) directive-named attribute should be left as native HTML: the
 * attribute name matches a build directive, its value is not brace-shaped, and the tag is one where
 * that name is genuinely native.
 */
export function isNativeBareAttribute(
	tag: string | undefined,
	attrName: string,
	value: string | null | undefined
): boolean {
	if (!tag) return false
	let canonical: BuildDirective
	try {
		canonical = canonicalBuildDirectiveName(attrName)
	} catch {
		return false
	}
	// Explicit `data-*` form is always a directive, never native passthrough.
	if (attrName !== canonical) return false
	if (looksBracedDirectiveValue(value)) return false
	return NATIVE_BARE_ATTR_ELEMENTS[canonical]?.has(tag.toLowerCase()) ?? false
}

/** Bare sugar: braced values, string `case`, boolean `else`/`default`, bare `props`. */
export function isBuildDirectiveAttribute(
	name: string,
	rawValue: string | null | undefined
): boolean {
	if (!isBuildDirectiveName(name)) return false
	const canonical = canonicalBuildDirectiveName(name)
	if (canonical === ATTR_ELSE || canonical === ATTR_DEFAULT) return true
	const trimmed = normalizeAttributeValue(rawValue).trim()
	if (canonical === ATTR_PROPS && !trimmed) return true
	if (canonical === ATTR_FOR) return looksBracedDirectiveValue(trimmed)
	if (canonical === ATTR_CASE) return trimmed.length > 0
	return looksBracedDirectiveValue(trimmed)
}

/**
 * True when a valued attribute should be flagged for missing brace-wrapped expression (VSCode /
 * compile validation). Returns false for native passthrough and already-braced values.
 */
export function requiresBracedDirectiveValue(
	attrName: string,
	value: string,
	tagName?: string
): boolean {
	let canonical: BuildDirective
	try {
		canonical = canonicalBuildDirectiveName(attrName)
	} catch {
		return false
	}
	if (!BRACED_VALUE_DIRECTIVES.has(canonical)) return false
	if (looksBracedDirectiveValue(value)) return false
	if (tagName && isNativeBareAttribute(tagName, attrName, value)) return false
	return true
}
