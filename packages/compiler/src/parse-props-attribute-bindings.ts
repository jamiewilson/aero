/**
 * Parse `props` / `data-props` attribute values for script/style injection tooling.
 *
 * @remarks
 * - Shorthand object `{ a, b }` injects globals `a`, `b`.
 * - Spread `{ ...theme }` injects keys from build-scope `theme` object literal (when known).
 * - Bare `props` injects keys from build-scope `props` object literal (when known).
 * - Keyed object `{ title: site.home.title }` injects global `title`; expression refs include `site`.
 */

const PROPS_VALUE_REGEX = /(?:^|\s)(?:data-)?props\s*=\s*["']([^"']*)["']/i
const BARE_PROPS_REGEX = /(?:^|\s)(?:data-)?props(?!\s*=)(?:\s|\/|$)/i
const SPREAD_VAR_REGEX = /\{\s*\.\.\.\s*([A-Za-z_$][\w$]*)\s*\}/
const JS_KEYWORD =
	/^(if|else|return|function|var|let|const|import|from|as|in|of|true|false|null|undefined)$/

/** Build-scope binding name → top-level object-literal property keys (when statically known). */
export type BuildBindingProperties = ReadonlyMap<string, ReadonlySet<string>>

export type ParsedPropsAttribute = {
	/** Global names made available in the script/style body. */
	injectedNames: readonly string[]
	/** Identifiers in the props expression that must resolve in build scope. */
	expressionRefs: readonly string[]
}

function unique(names: Iterable<string>): string[] {
	return [...new Set(names)]
}

function parseShorthandObjectKeys(inner: string): string[] {
	const out: string[] = []
	for (const part of inner.split(',')) {
		const candidate = part.trim()
		if (!candidate || candidate.startsWith('...')) continue
		const alias = candidate.split(':')[0]?.trim() ?? candidate
		if (/^[A-Za-z_$][\w$]*$/.test(alias)) out.push(alias)
	}
	return out
}

function extractExpressionIdentifiers(expression: string): string[] {
	const masked = expression.replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, match => ' '.repeat(match.length))
	const out: string[] = []
	const idRegex = /\b([A-Za-z_$][\w$]*)\b/g
	let match: RegExpExecArray | null
	while ((match = idRegex.exec(masked)) !== null) {
		const id = match[1]
		if (JS_KEYWORD.test(id)) continue
		const index = match.index
		const charBefore = index > 0 ? masked[index - 1] : ''
		if (charBefore === '.' && !(index >= 3 && masked.slice(index - 3, index) === '...')) continue
		out.push(id)
	}
	return unique(out)
}

function keysFromBuildBinding(
	name: string,
	buildBindingProperties?: BuildBindingProperties
): string[] {
	const keys = buildBindingProperties?.get(name)
	return keys ? [...keys] : []
}

function parsePropsValue(
	rawValue: string,
	buildBindingProperties?: BuildBindingProperties
): ParsedPropsAttribute {
	const value = rawValue.trim()
	if (!value) {
		return { injectedNames: [], expressionRefs: [] }
	}

	const spreadVar = value.match(SPREAD_VAR_REGEX)?.[1]
	if (spreadVar) {
		return {
			injectedNames: keysFromBuildBinding(spreadVar, buildBindingProperties),
			expressionRefs: [spreadVar],
		}
	}

	const braceMatch = /^\{([\s\S]*)\}$/.exec(value)
	const inner = (braceMatch ? braceMatch[1] : value).trim()
	if (!inner) {
		return { injectedNames: [], expressionRefs: extractExpressionIdentifiers(value) }
	}

	const hasKeyedEntry = /[A-Za-z_$][\w$]*\s*:/.test(inner)
	const shorthandKeys = parseShorthandObjectKeys(inner)
	const injectedNames = hasKeyedEntry
		? unique(
				inner
					.split(',')
					.map(part => part.trim().split(':')[0]?.trim() ?? '')
					.filter(name => /^[A-Za-z_$][\w$]*$/.test(name))
			)
		: shorthandKeys

	return {
		injectedNames,
		expressionRefs: extractExpressionIdentifiers(inner),
	}
}

/**
 * Parse a tag attribute string for `props` / `data-props` and return injected globals
 * plus build-scope identifiers referenced by the props expression.
 */
export function parsePropsAttributeBindings(
	attrs: string,
	buildBindingProperties?: BuildBindingProperties
): ParsedPropsAttribute {
	const valueMatch = attrs.match(PROPS_VALUE_REGEX)
	if (valueMatch) {
		return parsePropsValue(valueMatch[1], buildBindingProperties)
	}

	if (BARE_PROPS_REGEX.test(attrs)) {
		return {
			injectedNames: keysFromBuildBinding('props', buildBindingProperties),
			expressionRefs: [],
		}
	}

	return { injectedNames: [], expressionRefs: [] }
}

/**
 * Format ambient `declare const` lines for props-injected script globals.
 */
export function formatPropsInjectedAmbientDecls(
	names: readonly string[],
	typeByName?: ReadonlyMap<string, string>
): string {
	if (names.length === 0) return ''
	return (
		names
			.filter(n => n.length > 0)
			.map(n => {
				const t = typeByName?.get(n)?.trim()
				const typeStr = t && t.length > 0 ? t : 'any'
				return `declare const ${n}: ${typeStr};`
			})
			.join('\n') + '\n'
	)
}
