/**
 * Classifier for directive attributes (Alpine.js, HTMX, Vue, Aero runtime attrs) that should
 * skip { } interpolation in the compiler.
 *
 * @packageDocumentation
 */

import { normalizeRuntimeDirectiveName } from './runtime-directive-attributes'

/**
 * Configurable list of directive attribute prefixes and optional exact names.
 * Prefixes are checked with attrName.startsWith(prefix); single-char prefixes
 * like @, :, . match event and binding syntax.
 */
export interface DirectiveAttrConfig {
	/** Prefixes that identify directive attributes (e.g. 'x-', '@', 'hx-'). */
	prefixes?: string[]
	/** Exact attribute names to treat as directives. */
	exactNames?: string[]
}

/** Default prefixes: Alpine.js (x-*), HTMX (hx-*), and shorthand (@, :, .). */
export const DEFAULT_DIRECTIVE_PREFIXES: string[] = ['x-', 'hx-', '@', ':', '.']

const defaultConfig: DirectiveAttrConfig = {
	prefixes: DEFAULT_DIRECTIVE_PREFIXES,
	exactNames: [],
}

/**
 * Returns true if the attribute name is a directive that should skip
 * { } interpolation (e.g. Alpine x-model, :disabled, @click).
 *
 * @param attrName - HTML attribute name (e.g. 'x-data', ':disabled').
 * @param config - Optional config; uses default Alpine/shorthand prefixes when omitted.
 */
export function isDirectiveAttr(
	attrName: string,
	config: DirectiveAttrConfig = defaultConfig
): boolean {
	const prefixes = config.prefixes ?? defaultConfig.prefixes!
	const exactNames = config.exactNames ?? defaultConfig.exactNames!

	if (exactNames.includes(attrName)) return true
	if (prefixes.some(p => attrName.startsWith(p))) return true
	return normalizeRuntimeDirectiveName(attrName) !== null
}

/**
 * Returns true if the attribute name is a framework-specific attribute
 * that should be skipped in element attribute strings.
 */
export function isComponentAttr(attrName: string): boolean {
	return (
		attrName.startsWith('is:') ||
		attrName.startsWith('data-is:') ||
		attrName === 'slot' ||
		attrName === 'name'
	)
}
