import { describe, expect, it } from 'vitest'
import { CodeBuilder } from '../../code-builder'
import { escapeTemplateLiteralContent } from '../../escapes'
import * as Helper from '../../helpers'

describe('CodeBuilder', () => {
	it('matches emitAppend for ScriptPassData inner fragment', () => {
		const jsMapExpr = `Object.entries(props).map(([k, v]) => "\\nconst " + k + " = " + escapeScriptJson(v) + ";").join("")`
		const fromBuilder = new CodeBuilder().raw('${' + jsMapExpr + '}').raw('\\n').toString()
		const fromTemplate = `\${${jsMapExpr}}\\n`
		expect(fromBuilder).toBe(fromTemplate)
		expect(Helper.emitAppend(fromBuilder, '__out')).toBe(Helper.emitAppend(fromTemplate, '__out'))
	})

	it('matches emitAppend for StylePassData inner fragment', () => {
		const cssMapExpr = `Object.entries(p).map(([k, v]) => "\\n  --" + k + ": " + String(v) + ";").join("")`
		const fromBuilder = new CodeBuilder()
			.raw('\n:root {' + '${' + cssMapExpr + '}' + '\n}\n')
			.toString()
		const fromTemplate = `\n:root {\${${cssMapExpr}}\n}\n`
		expect(fromBuilder).toBe(fromTemplate)
		expect(Helper.emitAppend(fromBuilder, '__s')).toBe(Helper.emitAppend(fromTemplate, '__s'))
	})

	it('literal() applies escapeTemplateLiteralContent', () => {
		const b = new CodeBuilder().literal('a`b${c')
		expect(b.toString()).toBe(escapeTemplateLiteralContent('a`b${c'))
	})
})
