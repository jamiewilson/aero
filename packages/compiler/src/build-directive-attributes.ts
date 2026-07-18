/**
 * Single source of truth for Aero build-time directive attribute classification.
 *
 * Used by the compiler lowerer, prettier plugin, and VSCode diagnostics so native HTML
 * collision rules and braced-value requirements stay in sync.
 *
 * Reactive `{ stateRef }` bind dispatch lives in {@link ./reactive-attribute-classification.ts}.
 */

import {
	AERO_ATTR_PREFIX,
	ATTR_CASE,
	ATTR_DEFAULT,
	ATTR_ELSE,
	ATTR_ELSE_IF,
	ATTR_FOR,
	ATTR_IF,
	ATTR_PROPS,
	ATTR_SWITCH,
	DATA_AERO_ATTR_PREFIX,
	LEGACY_BUILD_ATTR_PREFIX,
	type BuildDirectivePrefixMode,
} from './constants'

/** Closed set of build directives that accept bare or prefixed names. */
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

export type { BuildDirectivePrefixMode }

/**
 * Elements on which a bare directive name is actually a real HTML attribute. A bare `for` is the
 * native attribute on `<label>`/`<output>`, `switch` on `<input>` (Safari toggle), `default` on
 * `<track>`. Prefixed forms are always explicit directives.
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

type AttributeNode = {
	hasAttribute?: (name: string) => boolean
	getAttribute?: (name: string) => string | null
}

export interface ClassifyBuildAttributeInput {
	tagName: string
	attrName: string
	rawValue: string | null | undefined
	parentHasSwitch?: boolean
}

export type BuildAttributeClassification =
	| { kind: 'not-build-directive' }
	| { kind: 'native-html'; directive: BuildDirective }
	| {
			kind: 'build-directive'
			directive: BuildDirective
			attrName: string
			requiresBracedValue: boolean
	  }
	| { kind: 'switch-branch'; directive: typeof ATTR_CASE | typeof ATTR_DEFAULT }
	| { kind: 'misplaced-switch-branch'; directive: typeof ATTR_CASE | typeof ATTR_DEFAULT }
	| { kind: 'invalid-braced-for-on-native-host'; directive: typeof ATTR_FOR }

function matchesBuildDirectiveName(name: string, directive: BuildDirective): boolean {
	return (
		name === directive ||
		name === AERO_ATTR_PREFIX + directive ||
		name === DATA_AERO_ATTR_PREFIX + directive
	)
}

function matchesBuildDirectiveNameForFormatting(name: string, directive: BuildDirective): boolean {
	return matchesBuildDirectiveName(name, directive) || name === LEGACY_BUILD_ATTR_PREFIX + directive
}

function isNativeBareAttributeMatch(
	tag: string,
	attrName: string,
	value: string | null | undefined
): boolean {
	const tagName = tag.toLowerCase()
	const canonical = resolveBuildDirectiveName(attrName)
	if (canonical == null) return false
	if (attrName !== canonical) return false
	if (looksBracedDirectiveValue(value)) return false
	return NATIVE_BARE_ATTR_ELEMENTS[canonical]?.has(tagName) ?? false
}

/** All attribute names that represent a build directive (bare + prefixed). */
export function buildDirectiveAttributeNames(directive: BuildDirective): readonly string[] {
	return [directive, AERO_ATTR_PREFIX + directive, DATA_AERO_ATTR_PREFIX + directive]
}

/** Format a canonical directive name for the given prefix mode. */
export function formatBuildDirectiveName(
	directive: BuildDirective,
	mode: BuildDirectivePrefixMode
): string {
	switch (mode) {
		case 'none':
			return directive
		case 'aero':
			return AERO_ATTR_PREFIX + directive
		case 'strict':
			return DATA_AERO_ATTR_PREFIX + directive
	}
}

/** Resolve a build directive attribute name to its canonical form, or null if not recognized. */
export function resolveBuildDirectiveName(name: string): BuildDirective | null {
	for (const directive of BUILD_DIRECTIVES) {
		if (matchesBuildDirectiveName(name, directive)) return directive
	}
	return null
}

/**
 * Resolve a build directive name for formatting input, including deprecated legacy `data-*` forms.
 */
export function resolveBuildDirectiveNameForFormatting(name: string): BuildDirective | null {
	for (const directive of BUILD_DIRECTIVES) {
		if (matchesBuildDirectiveNameForFormatting(name, directive)) return directive
	}
	return null
}

/** True when the attribute name uses an explicit prefix (`aero-*` or `data-aero-*`). */
export function isPrefixedBuildDirectiveName(name: string): boolean {
	const canonical = resolveBuildDirectiveName(name)
	if (canonical == null) return false
	return name !== canonical
}

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
	return resolveBuildDirectiveName(name) !== null
}

export function isBuildDirectiveNameForFormatting(name: string): boolean {
	return resolveBuildDirectiveNameForFormatting(name) !== null
}

export function canonicalBuildDirectiveName(name: string): BuildDirective {
	const resolved = resolveBuildDirectiveName(name)
	if (resolved == null) throw new Error(`Not a build directive: ${name}`)
	return resolved
}

export function canonicalBuildDirectiveNameForFormatting(name: string): BuildDirective {
	const resolved = resolveBuildDirectiveNameForFormatting(name)
	if (resolved == null) throw new Error(`Not a build directive: ${name}`)
	return resolved
}

/** True when a DOM node has a build directive attribute (any supported prefix form). */
export function hasBuildDirectiveAttribute(
	node: AttributeNode | null | undefined,
	directive: BuildDirective
): boolean {
	if (!node?.hasAttribute) return false
	for (const name of buildDirectiveAttributeNames(directive)) {
		if (node.hasAttribute(name)) return true
	}
	return false
}

/**
 * Read a build directive attribute from a DOM node. Returns the actual attribute name present and
 * its value, or null when absent.
 */
export function getBuildDirectiveAttribute(
	node: AttributeNode | null | undefined,
	directive: BuildDirective
): { name: string; value: string | null } | null {
	if (!node?.getAttribute) return null
	for (const name of buildDirectiveAttributeNames(directive)) {
		if (node.hasAttribute?.(name)) {
			return { name, value: node.getAttribute(name) }
		}
	}
	return null
}

/**
 * Classify a build-time attribute: native HTML passthrough, switch branch marker, or Aero directive.
 */
export function classifyBuildAttribute(input: ClassifyBuildAttributeInput): BuildAttributeClassification {
	const tagName = input.tagName.toLowerCase()
	const { attrName, rawValue } = input
	const canonical = resolveBuildDirectiveName(attrName)
	if (canonical == null) return { kind: 'not-build-directive' }

	const parentHasSwitch = input.parentHasSwitch ?? false

	if (canonical === ATTR_CASE || canonical === ATTR_DEFAULT) {
		if (parentHasSwitch) return { kind: 'switch-branch', directive: canonical }
		if (isNativeBareAttributeMatch(tagName, attrName, rawValue)) {
			return { kind: 'native-html', directive: canonical }
		}
		return { kind: 'misplaced-switch-branch', directive: canonical }
	}

	if (isNativeBareAttributeMatch(tagName, attrName, rawValue)) {
		return { kind: 'native-html', directive: canonical }
	}

	if (
		canonical === ATTR_FOR &&
		attrName === ATTR_FOR &&
		NATIVE_BARE_ATTR_ELEMENTS[ATTR_FOR].has(tagName) &&
		looksBracedDirectiveValue(rawValue)
	) {
		return { kind: 'invalid-braced-for-on-native-host', directive: ATTR_FOR }
	}

	// Bare `props` / `aero-props` / `data-aero-props` (no value) spreads local `props` — not a brace error.
	const isBarePropsShorthand =
		canonical === ATTR_PROPS && !normalizeAttributeValue(rawValue).trim()

	const requiresBracedValue =
		BRACED_VALUE_DIRECTIVES.has(canonical) &&
		!looksBracedDirectiveValue(rawValue) &&
		!isBarePropsShorthand

	return {
		kind: 'build-directive',
		directive: canonical,
		attrName,
		requiresBracedValue,
	}
}

/** Validation message for VS Code / compile-time brace checks, or null when valid. */
export function getBuildDirectiveValidationIssue(input: ClassifyBuildAttributeInput): string | null {
	const classification = classifyBuildAttribute(input)
	switch (classification.kind) {
		case 'build-directive':
			if (!classification.requiresBracedValue) return null
			return `Directive \`${input.attrName}\` must use a braced expression, e.g. ${input.attrName}="{ expression }"`
		case 'invalid-braced-for-on-native-host':
			return `Directive \`for\` on <${input.tagName}> cannot use a braced loop expression; use a plain \`for\` value for native IDREF.`
		default:
			return null
	}
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

/** Like {@link isBuildDirectiveAttribute} but accepts legacy `data-*` input for formatting. */
export function isBuildDirectiveAttributeForFormatting(
	name: string,
	rawValue: string | null | undefined
): boolean {
	if (!isBuildDirectiveNameForFormatting(name)) return false
	const canonical = canonicalBuildDirectiveNameForFormatting(name)
	if (canonical === ATTR_ELSE || canonical === ATTR_DEFAULT) return true
	const trimmed = normalizeAttributeValue(rawValue).trim()
	if (canonical === ATTR_PROPS && !trimmed) return true
	if (canonical === ATTR_FOR) return looksBracedDirectiveValue(trimmed)
	if (canonical === ATTR_CASE) return trimmed.length > 0
	return looksBracedDirectiveValue(trimmed)
}
