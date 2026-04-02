/**
 * Centralized escaping for generated JavaScript and template literals.
 *
 * @remarks
 * Single source of truth for compile-time emission; runtime helpers (`escapeHtml` in render
 * context) mirror the HTML rules where applicable.
 */

/** Escape characters with special meaning inside generated template literals. */
export function escapeTemplateLiteralContent(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/**
 * Escape `\\` and `` ` `` only — preserves `${…}` so nested codegen interpolations stay valid.
 * Use for slot default bodies and other fragments that already contain `${ await … }`.
 */
export function escapeCodegenTemplateBody(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
}

/**
 * Escape literal text embedded in HTML double-quoted attribute values in generated markup
 * (`attr="…"`). Prevents `"` / `&` / `<` from breaking attributes or the surrounding template.
 */
export function escapeHtmlAttributeLiteral(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Escape HTML special characters for safe output (runtime helper semantics). */
export function escapeHtml(s: unknown): string {
	if (s == null) return ''
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/** Escape JSON for safe embedding inside inline `<script>` tags. */
export function escapeScriptJson(value: unknown): string {
	return JSON.stringify(value)
		.replace(/</g, '\\u003C')
		.replace(/>/g, '\\u003E')
		.replace(/&/g, '\\u0026')
		.replace(/\//g, '\\u002F')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029')
}
