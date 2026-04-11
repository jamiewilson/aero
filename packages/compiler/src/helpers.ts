/**
 * Helpers for the template codegen: interpolation, attributes, slots, and render-function emission.
 */

import { tokenizeCurlyInterpolation } from './tokenizer'
import { CompileError } from './types'
import { CodeBuilder } from './code-builder'
import { escapeHtmlAttributeLiteral, escapeTemplateLiteralContent } from './escapes'

export {
	escapeCodegenTemplateBody,
	escapeHtmlAttributeLiteral,
	escapeTemplateLiteralContent,
	escapeHtml,
	escapeScriptJson,
} from './escapes'

/** Compute line and column from a byte offset in source text (1-based line, 0-based column). */
export function lineColumnAtOffset(
	source: string,
	offset: number
): { line: number; column: number } {
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
 * Compile text for use inside a template literal; replaces `{ expr }` with `${ escapeHtml(expr) }`.
 * Auto-escapes HTML to prevent XSS attacks. Use `raw(expr)` to bypass escaping.
 */
export function compileInterpolation(text: string): string {
	if (!text) return ''
	const segments = tokenizeCurlyInterpolation(text, { attributeMode: false })
	return segments
		.map(seg => {
			if (seg.kind === 'literal') {
				return escapeTemplateLiteralContent(seg.value)
			}
			// raw(...) bypasses escaping - check with trimmed expression
			const expr = seg.expression.trim()
			if (/^raw\s*\(/.test(expr)) {
				return `\${${seg.expression}}`
			}
			return `\${escapeHtml(${seg.expression})}`
		})
		.join('')
}

/**
 * Compile an attribute value: `{ expr }` → interpolation; `{{` / `}}` → literal `{` / `}`.
 * Attributes are NOT auto-escaped (browser handles XML escaping).
 */
export function compileAttributeInterpolation(text: string): string {
	if (!text) return ''
	const segments = tokenizeCurlyInterpolation(text, { attributeMode: true })
	return segments
		.map(seg => {
			if (seg.kind === 'literal') {
				return escapeTemplateLiteralContent(escapeHtmlAttributeLiteral(seg.value))
			}
			return `\${${seg.expression}}`
		})
		.join('')
}

/** True if `name` equals `attr` or `prefix + attr` (e.g. `for` or `data-for`). */
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

/** Backward-compatible alias for template-literal escaping. */
export function escapeBackticks(s: string): string {
	return escapeTemplateLiteralContent(s)
}

/** Bypass auto-escaping for raw HTML output. */
export function raw(s: unknown): string {
	if (s == null) return ''
	return String(s)
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
export const RENDER_INTERNAL_CONTEXT_KEYS: string[] = ['styles', 'scripts', 'headScripts']

// ============================================================================
// Default render function emission (Aero-compatible)
// ============================================================================

import type { EmitRenderFunctionOptions } from './types'

/**
 * Options for emitRenderFunction.
 */
export type { EmitRenderFunctionOptions as RenderFunctionOptions }

/** `styles?.add(…)` / `scripts?.add(…)` lines joined with `\\n\\t\\t` (render function body slot). */
function joinRenderFnIndentedLines(
	lines: string[],
	mapLine: (line: string) => string = line => line
): string {
	const b = new CodeBuilder()
	for (let i = 0; i < lines.length; i++) {
		if (i > 0) b.raw('\n\t\t')
		b.raw(mapLine(lines[i]))
	}
	return b.toString()
}

/** `styles?.add(…)` / `scripts?.add(…)` lines joined with `\\n\\t\\t` (render function body slot). */
function joinRenderFnRootAdds(kind: 'styles' | 'scripts', items: string[]): string {
	return joinRenderFnIndentedLines(items, item => `${kind}?.add(${JSON.stringify(item)});`)
}

/** `headScripts?.add(expr)` lines joined with `\\n\\t\\t`. */
function joinRenderFnHeadScripts(lines: string[]): string {
	return joinRenderFnIndentedLines(lines, line => `headScripts?.add(${line});`)
}

/** `rootScriptsLines` joined with `\\n\\t\\t`. */
function joinRenderFnRootScriptLines(lines: string[]): string {
	return joinRenderFnIndentedLines(lines)
}

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
		rootStyles && rootStyles.length > 0 ? joinRenderFnRootAdds('styles', rootStyles) : ''

	const scriptsCode =
		rootScripts && rootScripts.length > 0 ? joinRenderFnRootAdds('scripts', rootScripts) : ''

	const rootScriptsBlock =
		rootScriptsLines.length > 0 ? joinRenderFnRootScriptLines(rootScriptsLines) : ''

	const headScriptsBlock =
		headScriptsLines.length > 0 ? joinRenderFnHeadScripts(headScriptsLines) : ''

	const renderFn = new CodeBuilder()
		.raw('export default async function(Aero) {\n')
		.raw('\t\tconst { ')
		.raw(getRenderContextDestructurePattern())
		.raw(' } = Aero;\n')
		.raw('\t\t')
		.raw(script)
		.raw('\n\t\t')
		.raw(styleCode)
		.raw('\n\t\t')
		.raw(stylesCode)
		.raw('\n\t\t')
		.raw(scriptsCode)
		.raw('\n\t\t')
		.raw(rootScriptsBlock)
		.raw('\n\t\t')
		.raw(headScriptsBlock)
		.raw("\n\t\tlet __out = '';")
		.raw('\n\t\t')
		.raw(body)
		.raw('return __out;\n')
		.raw('\t}')
		.toString()

	if (getStaticPathsFn) {
		return new CodeBuilder().raw(getStaticPathsFn).raw('\n\n').raw(renderFn).toString().trim()
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
	return `slots = {}, renderComponent, ${RENDER_INTERNAL_CONTEXT_KEYS.join(', ')}, nextPassDataId, escapeHtml, escapeScriptJson, raw`
}

// ============================================================================
// Statement-emitting helpers
// ============================================================================

/** Emit `let varName = '';` for a slot accumulator. */
export function emitSlotVar(varName: string): string {
	return new CodeBuilder().stmtSlotVar(varName).toString()
}

/** Emit `outVar += \`content\`;` (default `outVar` is `__out`). */
export function emitAppend(content: string, outVar = '__out'): string {
	return new CodeBuilder().stmtAppendOut(content, outVar).toString()
}

/** Emit `if (condition) {`. */
export function emitIf(condition: string): string {
	return new CodeBuilder().stmtIf(condition).toString()
}

/** Emit `} else if (condition) {`. */
export function emitElseIf(condition: string): string {
	return new CodeBuilder().stmtElseIf(condition).toString()
}

/** Emit `} else {`. */
export function emitElse(): string {
	return new CodeBuilder().stmtElse().toString()
}

/** Emit `}`. */
export function emitEnd(): string {
	return new CodeBuilder().stmtEnd().toString()
}

/** Emit `outVar += slots[…] ?? \`defaultContent\`;` (default `outVar` is `__out`). */
export function emitSlotOutput(name: string, defaultContent: string, outVar = '__out'): string {
	return new CodeBuilder().stmtSlotOutput(name, defaultContent, outVar).toString()
}

/** Emit `outVar += await Aero.renderComponent(…);` with the given slots object expression. */
export function emitRenderComponentStatement(
	targetVar: string,
	baseName: string,
	propsString: string,
	slotsObjectExpr: string,
	contextArg: string
): string {
	return new CodeBuilder()
		.stmtRenderComponent(targetVar, baseName, propsString, slotsObjectExpr, contextArg)
		.toString()
}
