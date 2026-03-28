/**
 * Helpers for the template codegen: interpolation, attributes, slots, and render-function emission.
 */

import { tokenizeCurlyInterpolation, compileInterpolationFromSegments } from './tokenizer'
import { CompileError, type CompileErrorOptions } from './types'

/** Compute line and column from a byte offset in source text (1-based line, 0-based column). */
function lineColumnAtOffset(source: string, offset: number): { line: number; column: number } {
	const o = Math.max(0, Math.min(offset, source.length))
	let line = 1
	let lineStart = 0
	for (let i = 0; i < o; i++) {
		if (source.charCodeAt(i) === 10) {
			line++
			lineStart = i + 1
		}
	}
	return { line, column: o - lineStart }
}

/** Options for validateSingleBracedExpression (directive/tag for error message). */
export interface ValidateSingleBracedExpressionOptions {
	directive?: string
	tagName?: string
	diagnosticSource?: string
	diagnosticFile?: string
	positionNeedle?: string
}

/**
 * Validate that a value is a single well-formed braced expression using the same tokenizer as
 * attribute interpolation. Used for props (and optionally other braced directives); emission
 * stays expression-passthrough.
 */
export function validateSingleBracedExpression(
	value: string,
	options: ValidateSingleBracedExpressionOptions = {}
): string {
	const trimmed = value.trim()
	const segments = tokenizeCurlyInterpolation(trimmed, { attributeMode: true })
	const ok =
		segments.length === 1 &&
		segments[0].kind === 'interpolation' &&
		segments[0].start === 0 &&
		segments[0].end === trimmed.length
	if (!ok) {
		const directive = options.directive ?? 'directive'
		const tagName = options.tagName ?? 'element'
		const message = `Directive \`${directive}\` on <${tagName}> must use a braced expression, e.g. ${directive}="{ expression }".`
		const src = options.diagnosticSource
		const needle = options.positionNeedle
		const file = options.diagnosticFile
		if (src !== undefined && needle !== undefined && needle.length > 0) {
			const idx = src.indexOf(needle)
			if (idx >= 0) {
				const { line, column } = lineColumnAtOffset(src, idx)
				throw new CompileError({ message, file, line, column })
			}
		}
		if (file !== undefined) {
			throw new CompileError({ message, file })
		}
		throw new Error(message)
	}
	return trimmed
}

/**
 * Compile text for use inside a template literal; replaces `{ expr }` with `${ expr }`.
 */
export function compileInterpolation(text: string): string {
	if (!text) return ''
	const segments = tokenizeCurlyInterpolation(text, { attributeMode: false })
	return compileInterpolationFromSegments(segments)
}

/**
 * Compile an attribute value: `{ expr }` → interpolation; `{{` / `}}` → literal `{` / `}`.
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
		return entries.length > 0 ? `{ ${spreadExpr}, ${entries.join(', ')} }` : `{ ${spreadExpr} }`
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

// ============================================================================
// Internal context keys (Aero-specific, but needed for default emit)
// ============================================================================

/**
 * Internal context keys destructured from the render context and forwarded to child components.
 * User-facing data (`page`, `site`, `props`) is NOT destructured.
 */
export const RENDER_INTERNAL_CONTEXT_KEYS: string[] = [
	'styles',
	'scripts',
	'headScripts',
]

// ============================================================================
// Default render function emission (Aero-compatible)
// ============================================================================

import type { EmitRenderFunctionOptions } from './types'

/**
 * Options for emitRenderFunction.
 */
export type { EmitRenderFunctionOptions as RenderFunctionOptions }

/**
 * Emit the default async render function for Aero.
 */
export function emitRenderFunction(
	script: string,
	body: string,
	options: EmitRenderFunctionOptions = {}
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
			? headScriptsLines.map(s => `headScripts?.add(${s});`).join('\n\t\t')
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

/** Emit the 4th (context) argument to Aero.renderComponent(component, props, slots, CONTEXT). */
export function getRenderComponentContextArg(): string {
	const internalEntries = RENDER_INTERNAL_CONTEXT_KEYS.join(', ')
	return `{ page: Aero.page, site: Aero.site, ${internalEntries} }`
}

/** Build destructuring pattern for the render function. */
export function getRenderContextDestructurePattern(): string {
	return `slots = {}, renderComponent, ${RENDER_INTERNAL_CONTEXT_KEYS.join(', ')}, nextPassDataId`
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
export function emitSlotOutput(name: string, defaultContent: string, outVar = '__out'): string {
	return `${outVar} += slots['${name}'] ?? \`${defaultContent}\`;\n`
}
