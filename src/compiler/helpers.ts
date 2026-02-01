/**
 * Compiles a text node, handling TBD's interpolation syntax.
 * Replaces `{...}` with `${...}` for JS template literals.
 */
export function compileInterpolation(text: string): string {
	if (!text) return ''
	// Escape backticks to prevent breaking the template literal
	let compiled = text.replace(/`/g, '\\`')

	// Convert {expression} to ${expression}
	// Note: distinct from Alpine's x-text or similar. This is for static text content.
	compiled = compiled.replace(/{([\s\S]+?)}/g, '${$1}')

	return compiled
}
