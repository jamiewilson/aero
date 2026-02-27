/**
 * Classifier for directive attributes (Alpine.js, HTMX, Vue, etc.) that should
 * skip { } interpolation in the compiler. Replaces ALPINE_ATTR_REGEX with a
 * declarative list for clearer semantics and easier extension.
 *
 * @packageDocumentation
 */

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

/** Default prefixes: Alpine.js (x-*) and shorthand (@, :, .). */
export const DEFAULT_DIRECTIVE_PREFIXES: string[] = ['x-', '@', ':', '.']

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
	config: DirectiveAttrConfig = defaultConfig,
): boolean {
	const prefixes = config.prefixes ?? defaultConfig.prefixes!
	const exactNames = config.exactNames ?? defaultConfig.exactNames!

	if (exactNames.includes(attrName)) return true
	return prefixes.some((p) => attrName.startsWith(p))
}
