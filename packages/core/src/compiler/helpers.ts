/**
 * Helpers for the Aero codegen: interpolation, attributes, slots, and render-function emission.
 *
 * @remarks
 * Used by `codegen.ts` to compile `{ expr }` to template literals, build props/slots code, and emit
 * the top-level render wrapper.
 */

import {
	tokenizeCurlyInterpolation,
	compileInterpolationFromSegments,
} from './tokenizer'

/**
 * Compile text for use inside a template literal; replaces `{ expr }` with `${ expr }`.
 *
 * @param text - Raw text (may contain `{...}` interpolation).
 * @returns String safe for embedding in a template literal (backticks escaped).
 */
export function compileInterpolation(text: string): string {
	if (!text) return ''
	const segments = tokenizeCurlyInterpolation(text, { attributeMode: false })
	return compileInterpolationFromSegments(segments)
}

/**
 * Compile an attribute value: `{ expr }` → interpolation; `{{` / `}}` → literal `{` / `}`.
 *
 * @param text - Attribute value string.
 * @returns String safe for template literal (backticks escaped, double-braces as literals).
 */
export function compileAttributeInterpolation(text: string): string {
	if (!text) return ''
	const segments = tokenizeCurlyInterpolation(text, { attributeMode: true })
	return compileInterpolationFromSegments(segments)
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

	const rootScriptsBlock = rootScriptsLines.length > 0 ? rootScriptsLines.join('\n\t\t') : ''
	const headScriptsBlock =
		headScriptsLines.length > 0
			? headScriptsLines.map(s => `injectedHeadScripts?.add(${s});`).join('\n\t\t')
			: ''

	const renderFn = `export default async function(Aero) {
		const { ${getRenderContextDestructurePattern()} } = Aero;
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
// renderComponent context (single source of truth for emit + codegen)
// ============================================================================

/**
 * Pairs of [inputKey, destructuredVarName] for the 4th argument to Aero.renderComponent(..., input).
 * Must stay in sync with runtime createContext / AeroRenderInput fields used by renderComponent.
 */
export const RENDER_COMPONENT_CONTEXT_PAIRS: [key: string, varName: string][] = [
	['request', 'request'],
	['url', 'url'],
	['params', 'params'],
	['site', '__aero_site'],
	['styles', 'styles'],
	['scripts', 'scripts'],
	['headScripts', 'injectedHeadScripts'],
]

/** Emit the 4th (context) argument to Aero.renderComponent(component, props, slots, CONTEXT). Used by emit.ts and codegen.ts. */
export function getRenderComponentContextArg(): string {
	const entries = RENDER_COMPONENT_CONTEXT_PAIRS.map(([key, varName]) =>
		key === varName ? key : `${key}: ${varName}`,
	)
	return `{ ${entries.join(', ')} }`
}

/** Build destructuring pattern for the render function: request, url, params, site: __aero_site, ... */
export function getRenderContextDestructurePattern(): string {
	const entries = RENDER_COMPONENT_CONTEXT_PAIRS.map(([key, varName]) =>
		key === varName ? key : `${key}: ${varName}`,
	)
	return `slots = {}, renderComponent, ${entries.join(', ')}`
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
