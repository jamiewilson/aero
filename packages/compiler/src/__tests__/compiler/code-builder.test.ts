import { describe, expect, it } from 'vitest'
import { CodeBuilder } from '../../code-builder'
import { escapeTemplateLiteralContent } from '../../escapes'
import * as Helper from '../../helpers'

describe('CodeBuilder', () => {
	it('matches emitAppend for ScriptPassData inner fragment', () => {
		const jsMapExpr = `Object.entries(props).map(([k, v]) => "\\nconst " + k + " = " + Helper.escapeScriptJson(v) + ";").join("")`
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

	describe('stmt* matches helpers emit*', () => {
		it('stmtAppendOut', () => {
			expect(new CodeBuilder().stmtAppendOut('x', '__out').toString()).toBe(Helper.emitAppend('x', '__out'))
		})
		it('stmtSlotVar', () => {
			expect(new CodeBuilder().stmtSlotVar('__s').toString()).toBe(Helper.emitSlotVar('__s'))
		})
		it('stmtSlotOutput', () => {
			expect(new CodeBuilder().stmtSlotOutput('default', 'f', '__out').toString()).toBe(
				Helper.emitSlotOutput('default', 'f', '__out')
			)
		})
		it('stmtIf / stmtElseIf / stmtElse / stmtEnd', () => {
			expect(new CodeBuilder().stmtIf('a').toString()).toBe(Helper.emitIf('a'))
			expect(new CodeBuilder().stmtElseIf('b').toString()).toBe(Helper.emitElseIf('b'))
			expect(new CodeBuilder().stmtElse().toString()).toBe(Helper.emitElse())
			expect(new CodeBuilder().stmtEnd().toString()).toBe(Helper.emitEnd())
		})
		it('stmtRenderComponent', () => {
			expect(
				new CodeBuilder()
					.stmtRenderComponent('__out', 'Header', '{}', '{ "default": __slot_0 }', '{ ctx: 1 }')
					.toString()
			).toBe(Helper.emitRenderComponentStatement('__out', 'Header', '{}', '{ "default": __slot_0 }', '{ ctx: 1 }'))
		})
		it('stmtStylesAdd', () => {
			expect(new CodeBuilder().stmtStylesAdd('__aero_style_0').toString()).toBe(
				'styles?.add(__aero_style_0);\n'
			)
		})
	})
})
