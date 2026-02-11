/**
 * Compiles a text node, handling TBD's interpolation syntax.
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

/** Emits the top-level render function wrapper (script + body statements). */
export function emitRenderFunction(script: string, body: string): string {
	return `export default async function(tbd) {
		const { site, slots = {}, renderComponent } = tbd;
		${script}
		let __out = '';
		${body}return __out;
	}`.trim()
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
