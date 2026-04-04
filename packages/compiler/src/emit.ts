/**
 * Emit IR to JavaScript source string.
 *
 * @remarks
 * Single emission path: all template body/style JS is produced here via the
 * helpers. Enables alternate backends (e.g. streaming) by replacing this module.
 */

import type { IRNode, BodyAndStyleIR } from './ir'
import { CodeBuilder } from './code-builder'
import * as Helper from './helpers'

const DEFAULT_OUT = '__out'
let emittedInternalId = 0

function nextInternalId(prefix: string): string {
	return `__aero_${prefix}_${emittedInternalId++}`
}

function emitForLoopInto(
	b: CodeBuilder,
	binding: string,
	iterable: string,
	body: IRNode[],
	outVar: string
): void {
	const uid = nextInternalId('iter')
	const iterVar = `__aeroIter_${uid}`
	const iVar = `__aeroI_${uid}`
	b.raw('{\n')
	b.raw(`const ${iterVar} = (${iterable});\n`)
	b.raw(`const length = ${iterVar}.length;\n`)
	b.raw(`let ${iVar} = 0;\n`)
	b.raw(`for (const ${binding} of ${iterVar}) {\n`)
	b.raw(`const index = ${iVar}++;\n`)
	b.raw(`const first = index === 0;\n`)
	b.raw(`const last = index === length - 1;\n`)
	emitToJSInto(b, body, outVar)
	b.raw('}\n')
	b.raw('}\n')
}

function outVarFor(node: IRNode, defaultVar: string): string {
	switch (node.kind) {
		case 'Append':
		case 'Slot':
		case 'Component':
			return node.outVar ?? defaultVar
		case 'ScriptPassData':
		case 'StylePassData':
			return node.outVar
		default:
			return defaultVar
	}
}

function emitNodeAppend(b: CodeBuilder, node: IRNode, outVar: string): void {
	switch (node.kind) {
		case 'Append':
			b.stmtAppendOut(node.content, outVarFor(node, outVar))
			break
		case 'For':
			emitForLoopInto(b, node.binding, node.items, node.body, outVar)
			break
		case 'If': {
			let code = new CodeBuilder().stmtIf(node.condition).toString()
			const bodyB = new CodeBuilder()
			emitToJSInto(bodyB, node.body, outVar)
			code += bodyB.toString()
			if (node.elseIf?.length) {
				for (const branch of node.elseIf) {
					code = code.slice(0, -2) + new CodeBuilder().stmtElseIf(branch.condition).toString()
					const branchB = new CodeBuilder()
					emitToJSInto(branchB, branch.body, outVar)
					code += branchB.toString()
				}
			}
			if (node.else?.length) {
				code = code.slice(0, -2) + new CodeBuilder().stmtElse().toString()
				const elseB = new CodeBuilder()
				emitToJSInto(elseB, node.else, outVar)
				code += elseB.toString()
			}
			b.raw(code + new CodeBuilder().stmtEnd().toString())
			break
		}
		case 'Switch': {
			const expr = node.expression
			if (node.cases.length === 0) {
				if (node.defaultBody !== undefined) {
					emitToJSInto(b, node.defaultBody, outVar)
				}
				break
			}
			let code = ''
			for (let ci = 0; ci < node.cases.length; ci++) {
				const branch = node.cases[ci]!
				const cond = branch.comparandExprs.map(k => `(${expr}) === (${k})`).join(' || ')
				if (ci === 0) {
					code = new CodeBuilder().stmtIf(cond).toString()
					const bodyB = new CodeBuilder()
					emitToJSInto(bodyB, branch.body, outVar)
					code += bodyB.toString()
				} else {
					code = code.slice(0, -2) + new CodeBuilder().stmtElseIf(cond).toString()
					const bodyB = new CodeBuilder()
					emitToJSInto(bodyB, branch.body, outVar)
					code += bodyB.toString()
				}
			}
			if (node.defaultBody !== undefined) {
				code = code.slice(0, -2) + new CodeBuilder().stmtElse().toString()
				const elseB = new CodeBuilder()
				emitToJSInto(elseB, node.defaultBody, outVar)
				code += elseB.toString()
			}
			b.raw(code + new CodeBuilder().stmtEnd().toString())
			break
		}
		case 'Slot':
			b.stmtSlotOutput(node.name, node.defaultContent, outVarFor(node, outVar))
			break
		case 'SlotVar':
			b.stmtSlotVar(node.varName)
			break
		case 'Component': {
			for (const [slotName, slotIR] of Object.entries(node.slots)) {
				const slotVar = node.slotVarMap[slotName]
				if (slotVar === undefined) continue
				b.stmtSlotVar(slotVar)
				emitToJSInto(b, slotIR, slotVar)
			}
			const slotsString = Helper.emitSlotsObjectVars(node.slotVarMap)
			const targetVar = outVarFor(node, outVar)
			b.stmtRenderComponent(
				targetVar,
				node.baseName,
				node.propsString,
				slotsString,
				Helper.getRenderComponentContextArg()
			)
			break
		}
		case 'ScriptPassData': {
			if (!node.isModule) {
				b.stmtAppendOut('\\n{\\n', node.outVar)
			}
			const jsMapExpr = `Object.entries(${node.passDataExpr}).map(([k, v]) => "\\nconst " + k + " = " + escapeScriptJson(v) + ";").join("")`
			const scriptInner = new CodeBuilder()
				.raw('${' + jsMapExpr + '}')
				.raw('\\n')
				.toString()
			b.stmtAppendOut(scriptInner, node.outVar)
			break
		}
		case 'StylePassData': {
			const cssMapExpr = `Object.entries(${node.passDataExpr}).map(([k, v]) => "\\n  --" + k + ": " + String(v) + ";").join("")`
			const styleInner = new CodeBuilder()
				.raw('\n:root {' + '${' + cssMapExpr + '}' + '\n}\n')
				.toString()
			b.stmtAppendOut(styleInner, node.outVar)
			break
		}
		default: {
			const _: never = node
			void _
			break
		}
	}
}

/**
 * Append JS for `ir` to `b`, appending to `outVar`.
 */
function emitToJSInto(b: CodeBuilder, ir: IRNode[], outVar: string): void {
	for (const node of ir) {
		emitNodeAppend(b, node, outVar)
	}
}

/**
 * Emit a list of IR nodes to JS statements appending to `outVar`.
 *
 * @param ir - List of IR nodes (body or style fragment).
 * @param outVar - Accumulator variable (default `__out`).
 * @returns Generated JS string.
 */
export function emitToJS(ir: IRNode[], outVar: string = DEFAULT_OUT): string {
	const b = new CodeBuilder()
	emitToJSInto(b, ir, outVar)
	return b.toString()
}

/**
 * Emit style IR into `let styleVar = '';` … `styles?.add(styleVar);` using the same `CodeBuilder`
 * path as {@link emitBodyAndStyle} (and top-level `<style>` tags in template analysis).
 */
export function emitStyleBlock(ir: IRNode[], styleVar: string): string {
	const b = new CodeBuilder()
	b.stmtSlotVar(styleVar)
	emitToJSInto(b, ir, styleVar)
	b.stmtStylesAdd(styleVar)
	return b.toString()
}

/**
 * Emit body and style IR to JS, and wrap style in a style var + styles?.add().
 * Matches current codegen behavior: bodyCode from body IR, styleCode from style IR.
 */
export function emitBodyAndStyle(ir: BodyAndStyleIR): {
	bodyCode: string
	styleCode: string
} {
	const bodyB = new CodeBuilder()
	emitToJSInto(bodyB, ir.body, DEFAULT_OUT)
	const bodyCode = bodyB.toString()

	let styleCode = ''
	if (ir.style.length > 0) {
		styleCode = emitStyleBlock(ir.style, nextInternalId('style'))
	}
	return { bodyCode, styleCode }
}
