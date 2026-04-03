/**
 * Builds emitted render-function JS: template-literal inner segments (`literal` / `raw`) and
 * full statements (`stmt*`) that mirror the `emit*` helpers in `helpers.ts`.
 */

import { escapeCodegenTemplateBody, escapeTemplateLiteralContent } from './escapes'

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

	// --- Statements (same strings as helpers `emit*`; enables one backend for IR emission) ---

	/** `outVar += \`content\`;\n` */
	stmtAppendOut(content: string, outVar = '__out'): this {
		return this.raw(`${outVar} += \`${content}\`;\n`)
	}

	/** `let varName = '';\n` */
	stmtSlotVar(varName: string): this {
		return this.raw(`let ${varName} = '';\n`)
	}

	/** `outVar += slots[…] ?? \`default\`;\n` */
	stmtSlotOutput(name: string, defaultContent: string, outVar = '__out'): this {
		const key = JSON.stringify(name)
		const body = escapeCodegenTemplateBody(defaultContent)
		return this.raw(`${outVar} += slots[${key}] ?? \`${body}\`;\n`)
	}

	/** `if (condition) {\n` */
	stmtIf(condition: string): this {
		return this.raw(`if (${condition}) {\n`)
	}

	/** `} else if (condition) {\n` */
	stmtElseIf(condition: string): this {
		return this.raw(`} else if (${condition}) {\n`)
	}

	/** `} else {\n` */
	stmtElse(): this {
		return this.raw(`} else {\n`)
	}

	/** `}\n` */
	stmtEnd(): this {
		return this.raw(`}\n`)
	}

	/** `targetVar += await Aero.renderComponent(…);\n` */
	stmtRenderComponent(
		targetVar: string,
		baseName: string,
		propsString: string,
		slotsObjectExpr: string,
		contextArg: string
	): this {
		return this.raw(
			`${targetVar} += await Aero.renderComponent(${baseName}, ${propsString}, ${slotsObjectExpr}, ${contextArg});\n`
		)
	}

	/** `styles?.add(styleVar);\n` */
	stmtStylesAdd(styleVar: string): this {
		return this.raw(`styles?.add(${styleVar});\n`)
	}

	toString(): string {
		return this.chunks.join('')
	}
}
