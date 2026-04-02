/**
 * Builds the inner segment of a generated `out += \`…\`;` statement with explicit control over
 * escaping vs raw fragments (for `${expression}` regions in emitted render code).
 */

import { escapeTemplateLiteralContent } from './escapes'

/**
 * Incrementally builds template-literal body text for `emitAppend` / `__out += \`…\`;`.
 */
export class CodeBuilder {
	private readonly chunks: string[] = []

	/** Escape backticks and `${` so `value` is safe as static text inside the generated template. */
	literal(value: string): this {
		this.chunks.push(escapeTemplateLiteralContent(value))
		return this
	}

	/**
	 * Append without escaping. Use for expression-shaped fragments such as
	 * `'${' + jsExpr + '}'` or sequences already matched to the previous emitter.
	 */
	raw(value: string): this {
		this.chunks.push(value)
		return this
	}

	toString(): string {
		return this.chunks.join('')
	}
}
