/**
 * Shared author-attribute prefix formatting and recognition.
 *
 * Criteria: rewrite Aero framework names that are not native HTML. Leave native HTML
 * (even when Aero binds them), third-party attrs, emit-only markers, and unimplemented
 * names (`computed:*`, `state`) alone.
 *
 * Prefix modes:
 * - `none` — author forms with colons (`is:build`, `on:click`)
 * - `aero` — ownership prefix; keep colons (`aero-is:build`, `aero-on:click`)
 * - `strict` — strict HTML; colons → hyphens (`data-aero-is-build`, `data-aero-on-click`)
 *
 * @see {@link ./build-directive-attributes.ts} for build directives and native collisions
 * @see docs/tooling/formatting.mdx
 */

import {
	AERO_ATTR_PREFIX,
	ATTR_KEY,
	DATA_AERO_ATTR_PREFIX,
	LEGACY_BUILD_ATTR_PREFIX,
	type BuildDirectivePrefixMode,
} from './constants'
import {
	BUILD_DIRECTIVES,
	classifyBuildAttribute,
	formatBuildDirectiveName,
	isBuildDirectiveAttributeForFormatting,
	looksBracedDirectiveValue,
	normalizeAttributeValue,
	resolveBuildDirectiveNameForFormatting,
	type BuildDirective,
} from './build-directive-attributes'
import { parseEventDirectiveName } from './event-directive-attributes'
import { normalizeRuntimeDirectiveName } from './runtime-directive-attributes'

export type { BuildDirectivePrefixMode as AeroAttributePrefixMode }

/** Simple runtime directives that Prettier may rewrite (excludes unimplemented `state`). */
export const PREFIXABLE_SIMPLE_RUNTIME_DIRECTIVES = ['busy', 'text', 'html', 'show'] as const
export type PrefixableSimpleRuntimeDirective = (typeof PREFIXABLE_SIMPLE_RUNTIME_DIRECTIVES)[number]

/** Script taxonomy kinds that accept bare / `aero-` / `data-aero-` spellings. */
export const PREFIXABLE_SCRIPT_IS_KINDS = ['build', 'state', 'inline', 'blocking'] as const
export type PrefixableScriptIsKind = (typeof PREFIXABLE_SCRIPT_IS_KINDS)[number]

const PREFIXABLE_SIMPLE_SET = new Set<string>(PREFIXABLE_SIMPLE_RUNTIME_DIRECTIVES)

/** Emit-only marker bodies (after strip + hyphenize) that are not author directives. */
const EMIT_ONLY_BODIES = new Set([
	'event',
	'bind',
	'component',
	'processed',
])

export type AuthorAttributeCanonical =
	| { family: 'build'; name: BuildDirective }
	| { family: 'key' }
	| { family: 'simple-runtime'; name: PrefixableSimpleRuntimeDirective }
	| { family: 'event'; event: string; modifiers: string[] }
	| { family: 'class'; className: string }
	| { family: 'bind'; propName: string }
	| { family: 'script-is'; kind: PrefixableScriptIsKind }

export interface ClassifyPrefixableAttributeInput {
	tagName: string
	attrName: string
	rawValue: string | null | undefined
}

function stripAuthorPrefixes(name: string): string {
	if (name.startsWith(DATA_AERO_ATTR_PREFIX)) return name.slice(DATA_AERO_ATTR_PREFIX.length)
	if (name.startsWith(AERO_ATTR_PREFIX)) return name.slice(AERO_ATTR_PREFIX.length)
	return name
}

function hyphenizeBody(body: string): string {
	return body.replace(/[:.]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '')
}

function isEmitOnlyMarkerName(attrName: string): boolean {
	const body = hyphenizeBody(stripAuthorPrefixes(attrName.trim()))
	if (EMIT_ONLY_BODIES.has(body)) return true
	if (body.startsWith('model-') || body.startsWith('property-')) return true
	return false
}

function resolveScriptIsKind(body: string): PrefixableScriptIsKind | null {
	const hyphenated = hyphenizeBody(body)
	for (const kind of PREFIXABLE_SCRIPT_IS_KINDS) {
		if (hyphenated === `is-${kind}`) return kind
	}
	return null
}

function resolveBindPropName(body: string): string | null {
	if (body.startsWith('bind:')) {
		const prop = body.slice('bind:'.length)
		return prop.length > 0 ? prop : null
	}
	if (body.startsWith('bind-') && body.length > 'bind-'.length) {
		return body.slice('bind-'.length)
	}
	return null
}

/**
 * Resolve an attribute name to its author-attribute canonical form for formatting.
 * Accepts bare, `aero-*`, `data-aero-*`, and legacy `data-*` (build directives only).
 */
export function resolveAuthorAttributeForFormatting(
	attrName: string
): AuthorAttributeCanonical | null {
	const trimmed = attrName.trim()
	if (!trimmed || isEmitOnlyMarkerName(trimmed)) return null

	const build = resolveBuildDirectiveNameForFormatting(trimmed)
	if (build != null) return { family: 'build', name: build }

	const body = stripAuthorPrefixes(trimmed)
	// Legacy data-* only for build (already handled); reject other legacy data-* here.
	if (
		trimmed.startsWith(LEGACY_BUILD_ATTR_PREFIX) &&
		!trimmed.startsWith(DATA_AERO_ATTR_PREFIX) &&
		trimmed === LEGACY_BUILD_ATTR_PREFIX + body
	) {
		return null
	}

	if (hyphenizeBody(body) === ATTR_KEY || body === ATTR_KEY) {
		return { family: 'key' }
	}

	const scriptKind = resolveScriptIsKind(body)
	if (scriptKind != null) return { family: 'script-is', kind: scriptKind }

	const bindProp = resolveBindPropName(body)
	if (bindProp != null) return { family: 'bind', propName: bindProp }

	const event = parseEventDirectiveName(trimmed)
	if (event.kind === 'ok') {
		return {
			family: 'event',
			event: event.directive.event,
			modifiers: event.directive.modifiers,
		}
	}

	const runtime = normalizeRuntimeDirectiveName(trimmed)
	if (!runtime || runtime.family !== 'binding') return null

	const bare = runtime.canonicalBareName
	if (bare === 'state' || bare.startsWith('computed-')) return null
	if (PREFIXABLE_SIMPLE_SET.has(bare)) {
		return { family: 'simple-runtime', name: bare as PrefixableSimpleRuntimeDirective }
	}
	if (bare.startsWith('class-') && bare.length > 'class-'.length) {
		return { family: 'class', className: bare.slice('class-'.length) }
	}
	return null
}

/** Format a resolved author attribute for the given prefix mode. */
export function formatAuthorAttributeName(
	canonical: AuthorAttributeCanonical,
	mode: BuildDirectivePrefixMode
): string {
	switch (canonical.family) {
		case 'build':
			return formatBuildDirectiveName(canonical.name, mode)
		case 'key':
			if (mode === 'none') return ATTR_KEY
			if (mode === 'aero') return AERO_ATTR_PREFIX + ATTR_KEY
			return DATA_AERO_ATTR_PREFIX + ATTR_KEY
		case 'simple-runtime': {
			const bare = canonical.name
			if (mode === 'none') return bare
			if (mode === 'aero') return AERO_ATTR_PREFIX + bare
			return DATA_AERO_ATTR_PREFIX + bare
		}
		case 'script-is': {
			const colonForm = `is:${canonical.kind}`
			const hyphenForm = `is-${canonical.kind}`
			if (mode === 'none') return colonForm
			if (mode === 'aero') return AERO_ATTR_PREFIX + colonForm
			return DATA_AERO_ATTR_PREFIX + hyphenForm
		}
		case 'event': {
			const modSuffixColon = canonical.modifiers.map(m => `.${m}`).join('')
			const modSuffixHyphen = canonical.modifiers.map(m => `-${m}`).join('')
			if (mode === 'none') return `on:${canonical.event}${modSuffixColon}`
			if (mode === 'aero') return `${AERO_ATTR_PREFIX}on:${canonical.event}${modSuffixColon}`
			return `${DATA_AERO_ATTR_PREFIX}on-${canonical.event}${modSuffixHyphen}`
		}
		case 'class': {
			if (mode === 'none') return `class:${canonical.className}`
			if (mode === 'aero') return `${AERO_ATTR_PREFIX}class:${canonical.className}`
			return `${DATA_AERO_ATTR_PREFIX}class-${canonical.className}`
		}
		case 'bind': {
			if (mode === 'none') return `bind:${canonical.propName}`
			if (mode === 'aero') return `${AERO_ATTR_PREFIX}bind:${canonical.propName}`
			return `${DATA_AERO_ATTR_PREFIX}bind-${canonical.propName}`
		}
	}
}

function passesValueGate(
	canonical: AuthorAttributeCanonical,
	attrName: string,
	rawValue: string | null | undefined
): boolean {
	const trimmed = normalizeAttributeValue(rawValue).trim()
	switch (canonical.family) {
		case 'build':
			return isBuildDirectiveAttributeForFormatting(attrName, rawValue)
		case 'key':
		case 'simple-runtime':
			return looksBracedDirectiveValue(trimmed)
		case 'event':
		case 'bind':
			return looksBracedDirectiveValue(trimmed)
		case 'class':
			// Bare shorthand (`class:is-active`) or braced value
			return !trimmed || looksBracedDirectiveValue(trimmed)
		case 'script-is':
			return true
	}
}

/**
 * True when Prettier should rewrite this attribute under `aeroAttributePrefix`.
 */
export function isPrefixableAuthorAttribute(input: ClassifyPrefixableAttributeInput): boolean {
	const classification = classifyBuildAttribute({
		tagName: input.tagName,
		attrName: input.attrName,
		rawValue: input.rawValue,
	})
	if (classification.kind === 'native-html') return false

	const canonical = resolveAuthorAttributeForFormatting(input.attrName)
	if (canonical == null) return false

	if (canonical.family === 'script-is' && input.tagName.toLowerCase() !== 'script') {
		return false
	}

	return passesValueGate(canonical, input.attrName, input.rawValue)
}

/** All recognized spellings of a script taxonomy attribute. */
export function scriptIsAttributeNames(kind: PrefixableScriptIsKind): readonly string[] {
	return [
		`is:${kind}`,
		`${AERO_ATTR_PREFIX}is:${kind}`,
		`${AERO_ATTR_PREFIX}is-${kind}`,
		`${DATA_AERO_ATTR_PREFIX}is-${kind}`,
	]
}

export function elementHasScriptIsAttribute(
	node: { hasAttribute?: (name: string) => boolean } | null | undefined,
	kind: PrefixableScriptIsKind
): boolean {
	if (!node?.hasAttribute) return false
	for (const name of scriptIsAttributeNames(kind)) {
		if (node.hasAttribute(name)) return true
	}
	return false
}

export function removeScriptIsAttribute(
	node: { removeAttribute?: (name: string) => void; hasAttribute?: (name: string) => boolean },
	kind: PrefixableScriptIsKind
): void {
	if (!node.removeAttribute) return
	for (const name of scriptIsAttributeNames(kind)) {
		if (node.hasAttribute?.(name)) node.removeAttribute(name)
	}
}

export function isScriptTaxonomyAttributeName(attrName: string): boolean {
	return resolveAuthorAttributeForFormatting(attrName)?.family === 'script-is'
}

/** Prop name for `bind:x` / `aero-bind:x` / `data-aero-bind-x`, or null. */
export function parseBindAttributePropName(attrName: string): string | null {
	const canonical = resolveAuthorAttributeForFormatting(attrName)
	return canonical?.family === 'bind' ? canonical.propName : null
}

export function isKeyAttributeName(attrName: string): boolean {
	return resolveAuthorAttributeForFormatting(attrName)?.family === 'key'
}

/** Closed set used by anti-drift tests (canonical bare / family descriptors). */
export function listPrefixableAuthorAttributeDescriptors(): readonly {
	family: AuthorAttributeCanonical['family']
	id: string
	exampleNone: string
}[] {
	const out: { family: AuthorAttributeCanonical['family']; id: string; exampleNone: string }[] = []
	for (const name of BUILD_DIRECTIVES) {
		out.push({ family: 'build', id: name, exampleNone: name })
	}
	out.push({ family: 'key', id: 'key', exampleNone: 'key' })
	for (const name of PREFIXABLE_SIMPLE_RUNTIME_DIRECTIVES) {
		out.push({ family: 'simple-runtime', id: name, exampleNone: name })
	}
	out.push({ family: 'event', id: 'on:click', exampleNone: 'on:click' })
	out.push({ family: 'event', id: 'on:submit.prevent', exampleNone: 'on:submit.prevent' })
	out.push({ family: 'class', id: 'class:is-active', exampleNone: 'class:is-active' })
	out.push({ family: 'bind', id: 'bind:count', exampleNone: 'bind:count' })
	for (const kind of PREFIXABLE_SCRIPT_IS_KINDS) {
		out.push({ family: 'script-is', id: `is:${kind}`, exampleNone: `is:${kind}` })
	}
	return out
}
