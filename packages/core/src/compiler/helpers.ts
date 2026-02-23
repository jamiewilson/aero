/**
 * Helpers for the Aero codegen: interpolation, attributes, slots, and render-function emission.
 *
 * @remarks
 * Used by `codegen.ts` to compile `{ expr }` to template literals, build props/slots code, and emit
 * the top-level render wrapper. Some helpers (e.g. `extractObjectKeys`) are also used by the Vite plugin.
 */

/**
 * Compile text for use inside a template literal; replaces `{ expr }` with `${ expr }`.
 *
 * @param text - Raw text (may contain `{...}` interpolation).
 * @returns String safe for embedding in a template literal (backticks escaped).
 */
export function compileInterpolation(text: string): string {
	if (!text) return ''
	// Escape backticks to prevent breaking the template literal
	let compiled = text.replace(/`/g, '\\`')
	// Convert {expression} to ${expression}
	compiled = compiled.replace(/{([\s\S]+?)}/g, '${$1}')
	return compiled
}

/**
 * Compile an attribute value: `{ expr }` → interpolation; `{{` / `}}` → literal `{` / `}`.
 *
 * @param text - Attribute value string.
 * @returns String safe for template literal (backticks escaped, double-braces replaced).
 */
export function compileAttributeInterpolation(text: string): string {
	if (!text) return ''

	const openSentinel = '__AERO_ESC_OPEN__'
	const closeSentinel = '__AERO_ESC_CLOSE__'

	let compiled = text.replace(/`/g, '\\`')
	compiled = compiled.replace(/{{/g, openSentinel).replace(/}}/g, closeSentinel)
	compiled = compiled.replace(/{([\s\S]+?)}/g, '${$1}')
	compiled = compiled
		.replace(new RegExp(openSentinel, 'g'), '{')
		.replace(new RegExp(closeSentinel, 'g'), '}')

	return compiled
}

/** True if `name` equals `attr` or `prefix + attr` (e.g. `each` or `data-each`). */
export function isAttr(name: string, attr: string, prefix: string): boolean {
	return name === attr || name === prefix + attr
}

/** Remove outer braces: `"{ expr }"` → `expr`. */
export function stripBraces(s: string): string {
	const trimmed = s.trim()
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		return trimmed.slice(1, -1).trim()
	}
	return trimmed
}

/** Convert kebab-case to camelCase (e.g. `my-component` → `myComponent`). */
export function kebabToCamelCase(s: string): string {
	return s.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

/** Build a props object code string from key-value entries and optional spread (e.g. `{ ...base, title }`). */
export function buildPropsString(entries: string[], spreadExpr: string | null): string {
	if (spreadExpr) {
		return entries.length > 0
			? `{ ${spreadExpr}, ${entries.join(', ')} }`
			: `{ ${spreadExpr} }`
	}
	return `{ ${entries.join(', ')} }`
}

/** Escape backticks for safe embedding in generated template literals. */
export function escapeBackticks(s: string): string {
	return s.replace(/`/g, '\\`')
}

/** Emit code for a slots object whose values are variable names (e.g. `{ "default": __slot0 }`). */
export function emitSlotsObjectVars(slotsMap: Record<string, string>): string {
	const entries = Object.entries(slotsMap)
		.map(([k, varName]) => `"${k}": ${varName}`)
		.join(', ')
	return '{ ' + entries + ' }'
}

/**
 * Extract `export [async] function getStaticPaths(...)` from build script content for top-level module export.
 *
 * @param script - Full build script content.
 * @returns Extracted function text (with `export`) and remaining script, or `{ fnText: null, remaining: script }` if not found/unbalanced.
 */
export function extractGetStaticPaths(script: string): {
	fnText: string | null
	remaining: string
} {
	const regex = /export\s+(async\s+)?function\s+getStaticPaths\s*\([^)]*\)\s*\{/
	const match = regex.exec(script)
	if (!match) return { fnText: null, remaining: script }

	const start = match.index
	const braceStart = start + match[0].length - 1

	let depth = 1
	let i = braceStart + 1
	let inString: null | '"' | "'" | '`' = null
	let inComment: null | '//' | '/*' = null

	while (i < script.length && depth > 0) {
		const char = script[i]
		const next = script[i + 1]

		// Handle comments
		if (inComment) {
			if (inComment === '//' && char === '\n') inComment = null
			else if (inComment === '/*' && char === '*' && next === '/') {
				inComment = null
				i++ // skip /
			}
		}
		// Handle strings
		else if (inString) {
			if (char === '\\') {
				i++ // skip escaped char
			} else if (char === inString) {
				inString = null
			}
		}
		// Handle start of comment/string or brace
		else {
			if (char === '/' && next === '/') {
				inComment = '//'
				i++
			} else if (char === '/' && next === '*') {
				inComment = '/*'
				i++
			} else if (char === '"' || char === "'" || char === '`') {
				inString = char
			} else if (char === '{') {
				depth++
			} else if (char === '}') {
				depth--
			}
		}
		i++
	}

	if (depth !== 0) {
		// Unbalanced braces — return as-is without extracting
		return { fnText: null, remaining: script }
	}

	const fnText = script.slice(start, i)
	const remaining = (script.slice(0, start) + script.slice(i)).trim()

	return { fnText, remaining }
}

/**
 * Options for emitRenderFunction. All optional; used by codegen as the single source of truth for render emission.
 */
export interface EmitRenderFunctionOptions {
	/** Extracted getStaticPaths to prepend as named export. */
	getStaticPathsFn?: string | null
	/** Style labels to add to `styles` set (simple string labels). */
	rootStyles?: string[]
	/** Script labels to add to `scripts` set (simple string labels). */
	rootScripts?: string[]
	/** Generated code for compiled <style> blocks (styles?.add(...)). */
	styleCode?: string
	/** Full statements that add client script tags to `scripts` (e.g. scripts?.add(...) or pass:data IIFE). */
	rootScriptsLines?: string[]
	/** Expressions for blocking head scripts (emitted as injectedHeadScripts?.add(...)). */
	headScriptsLines?: string[]
}

/**
 * Emit the default async render function: destructured context, script block, optional style/script/head blocks, then body that appends to `__out`.
 * Single source of truth for the shape of the compiled render function; codegen calls this with all sections.
 *
 * @param script - Build script content (imports + user code).
 * @param body - Generated statements that build the HTML string.
 * @param options - Optional getStaticPathsFn, rootStyles, rootScripts, styleCode, rootScriptsLines, headScriptsLines.
 * @returns Full module source (getStaticPaths + default render function).
 */
export function emitRenderFunction(
	script: string,
	body: string,
	options: EmitRenderFunctionOptions = {},
): string {
	const {
		getStaticPathsFn,
		rootStyles,
		rootScripts,
		styleCode = '',
		rootScriptsLines = [],
		headScriptsLines = [],
	} = options

	const stylesCode =
		rootStyles && rootStyles.length > 0
			? rootStyles.map(s => `styles?.add(${JSON.stringify(s)});`).join('\n\t\t')
			: ''

	const scriptsCode =
		rootScripts && rootScripts.length > 0
			? rootScripts.map(s => `scripts?.add(${JSON.stringify(s)});`).join('\n\t\t')
			: ''

	const rootScriptsBlock =
		rootScriptsLines.length > 0 ? rootScriptsLines.join('\n\t\t') : ''
	const headScriptsBlock =
		headScriptsLines.length > 0
			? headScriptsLines.map(s => `injectedHeadScripts?.add(${s});`).join('\n\t\t')
			: ''

	const renderFn = `export default async function(Aero) {
		const { slots = {}, renderComponent, request, url, params, site: __aero_site, styles, scripts, headScripts: injectedHeadScripts } = Aero;
		${script}
		${styleCode}
		${stylesCode}
		${scriptsCode}
		${rootScriptsBlock}
		${headScriptsBlock}
		let __out = '';
		${body}return __out;
	}`

	if (getStaticPathsFn) {
		return `${getStaticPathsFn}\n\n${renderFn}`.trim()
	}

	return renderFn.trim()
}

// ============================================================================
// Statement-emitting helpers
// ============================================================================

/** Emit `let varName = '';` for a slot accumulator. */
export function emitSlotVar(varName: string): string {
	return `let ${varName} = '';\n`
}

/** Emit `outVar += \`content\`;` (default `outVar` is `__out`). */
export function emitAppend(content: string, outVar = '__out'): string {
	return `${outVar} += \`${content}\`;\n`
}

/** Emit `if (condition) {`. */
export function emitIf(condition: string): string {
	return `if (${condition}) {\n`
}

/** Emit `} else if (condition) {`. */
export function emitElseIf(condition: string): string {
	return `} else if (${condition}) {\n`
}

/** Emit `} else {`. */
export function emitElse(): string {
	return `} else {\n`
}

/** Emit `}`. */
export function emitEnd(): string {
	return `}\n`
}

/** Emit `for (const item of items) {`. */
export function emitForOf(item: string, items: string): string {
	return `for (const ${item} of ${items}) {\n`
}

/** Emit `outVar += slots['name'] ?? \`defaultContent\`;` (default `outVar` is `__out`). */
export function emitSlotOutput(
	name: string,
	defaultContent: string,
	outVar = '__out',
): string {
	return `${outVar} += slots['${name}'] ?? \`${defaultContent}\`;\n`
}

/**
 * Extract top-level property keys from an object-literal expression string.
 *
 * @param expr - e.g. `{ title: expr, id: 42 }` or `{ config }` (shorthand).
 * @returns e.g. `['title', 'id']` or `['config']`. Does not support spread; callers must handle `...obj` separately.
 */
export function extractObjectKeys(expr: string): string[] {
	let inner = expr.trim()
	// Strip all matching outer braces (e.g. `{{ title }}` -> `title`)
	while (inner.startsWith('{') && inner.endsWith('}')) {
		inner = inner.slice(1, -1).trim()
	}

	if (!inner) return []

	const keys: string[] = []
	let depth = 0
	let current = ''

	for (let i = 0; i < inner.length; i++) {
		const char = inner[i]
		if (char === '{' || char === '[' || char === '(') {
			depth++
			current += char
		} else if (char === '}' || char === ']' || char === ')') {
			depth--
			current += char
		} else if (char === ',' && depth === 0) {
			// End of a property — extract the key
			const key = extractKeyFromEntry(current.trim())
			if (key) keys.push(key)
			current = ''
		} else {
			current += char
		}
	}

	// Handle the last entry
	const lastKey = extractKeyFromEntry(current.trim())
	if (lastKey) keys.push(lastKey)

	return keys
}

/** Extract key from one property entry: `key: value` → key, shorthand `ident` → ident; returns null for spread or invalid. */
function extractKeyFromEntry(entry: string): string | null {
	if (!entry) return null

	// Reject spread syntax
	if (entry.startsWith('...')) return null

	// Check for `key: value` pattern
	const colonIdx = entry.indexOf(':')
	if (colonIdx > 0) {
		return entry.slice(0, colonIdx).trim()
	}

	// Shorthand: bare identifier (e.g. `config`)
	if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(entry)) {
		return entry
	}

	return null
}
