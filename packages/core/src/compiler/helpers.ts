/**
 * Compiles a text node, handling Aero's interpolation syntax.
 * Replaces `{...}` with `${...}` for JS template literals.
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
 * Compiles an attribute value, supporting {expr} interpolation and escaped
 * literal braces via double-brace syntax: `{{` and `}}`.
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

/** Checks if an attribute name matches either 'attr' or 'data-attr' */
export function isAttr(name: string, attr: string, prefix: string): boolean {
	return name === attr || name === prefix + attr
}

/** Strips surrounding braces from a string: "{expr}" → "expr" */
export function stripBraces(s: string): string {
	const trimmed = s.trim()
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		return trimmed.slice(1, -1).trim()
	}
	return trimmed
}

/** Converts kebab-case to camelCase: "my-component" → "myComponent" */
export function kebabToCamelCase(s: string): string {
	return s.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

/** Builds a props object string from entries and optional spread expression */
export function buildPropsString(entries: string[], spreadExpr: string | null): string {
	if (spreadExpr) {
		return entries.length > 0
			? `{ ${spreadExpr}, ${entries.join(', ')} }`
			: `{ ${spreadExpr} }`
	}
	return `{ ${entries.join(', ')} }`
}

/** Escapes backticks in a string for safe embedding inside generated template literals. */
export function escapeBackticks(s: string): string {
	return s.replace(/`/g, '\\`')
}

/** Emits code for a slots object { "name": varName } using variable references */
export function emitSlotsObjectVars(slotsMap: Record<string, string>): string {
	const entries = Object.entries(slotsMap)
		.map(([k, varName]) => `"${k}": ${varName}`)
		.join(', ')
	return '{ ' + entries + ' }'
}

/**
 * Extracts an `export [async] function getStaticPaths(...)` from build script
 * content so it can be emitted as a top-level named module export.
 *
 * Returns the extracted function text (with `export` keyword) and the remaining
 * script with the function removed.
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

/** Emits the top-level render function wrapper (script + body statements). */
export function emitRenderFunction(
	script: string,
	body: string,
	getStaticPathsFn?: string | null,
	rootStyles?: string[],
	rootScripts?: string[],
): string {
	const stylesCode =
		rootStyles && rootStyles.length > 0
			? rootStyles.map(s => `styles?.add(${JSON.stringify(s)});`).join('\n\t\t')
			: ''

	const scriptsCode =
		rootScripts && rootScripts.length > 0
			? rootScripts.map(s => `scripts?.add(${JSON.stringify(s)});`).join('\n\t\t')
			: ''

	const renderFn = `export default async function(Aero) {
		const { site, slots = {}, renderComponent, request, url, params, styles, scripts } = Aero;
		${script}
		${stylesCode}
		${scriptsCode}
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

/** Emits: let varName = ''; */
export function emitSlotVar(varName: string): string {
	return `let ${varName} = '';\n`
}

/** Emits: outVar += `content`; */
export function emitAppend(content: string, outVar = '__out'): string {
	return `${outVar} += \`${content}\`;\n`
}

/** Emits: if (condition) { */
export function emitIf(condition: string): string {
	return `if (${condition}) {\n`
}

/** Emits: } else if (condition) { */
export function emitElseIf(condition: string): string {
	return `} else if (${condition}) {\n`
}

/** Emits: } else { */
export function emitElse(): string {
	return `} else {\n`
}

/** Emits: } */
export function emitEnd(): string {
	return `}\n`
}

/** Emits: for (const item of items) { */
export function emitForOf(item: string, items: string): string {
	return `for (const ${item} of ${items}) {\n`
}

/** Emits: outVar += slots['name'] ?? `defaultContent`; */
export function emitSlotOutput(
	name: string,
	defaultContent: string,
	outVar = '__out',
): string {
	return `${outVar} += slots['${name}'] ?? \`${defaultContent}\`;\n`
}
