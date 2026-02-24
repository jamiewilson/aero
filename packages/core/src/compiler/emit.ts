/**
 * Emit IR to JavaScript source string.
 *
 * @remarks
 * Single emission path: all template body/style JS is produced here via the
 * helpers. Enables alternate backends (e.g. streaming) by replacing this module.
 */

import type { IRNode, BodyAndStyleIR } from './ir'
import * as Helper from './helpers'

const DEFAULT_OUT = '__out'

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

/**
 * Emit a list of IR nodes to JS statements appending to `outVar`.
 *
 * @param ir - List of IR nodes (body or style fragment).
 * @param outVar - Accumulator variable (default `__out`).
 * @returns Generated JS string.
 */
export function emitToJS(ir: IRNode[], outVar: string = DEFAULT_OUT): string {
	let out = ''
	for (const node of ir) {
		out += emitNode(node, outVar)
	}
	return out
}

function emitNode(node: IRNode, outVar: string): string {
	switch (node.kind) {
		case 'Append':
			return Helper.emitAppend(node.content, outVarFor(node, outVar))
		case 'For':
			return (
				Helper.emitForOf(node.item, node.items) +
				emitToJS(node.body, outVar) +
				Helper.emitEnd()
			)
		case 'If': {
			let code = Helper.emitIf(node.condition) + emitToJS(node.body, outVar)
			if (node.elseIf?.length) {
				for (const branch of node.elseIf) {
					code = code.slice(0, -2) + Helper.emitElseIf(branch.condition)
					code += emitToJS(branch.body, outVar)
				}
			}
			if (node.else?.length) {
				code = code.slice(0, -2) + Helper.emitElse()
				code += emitToJS(node.else, outVar)
			}
			return code + Helper.emitEnd()
		}
		case 'Slot':
			return Helper.emitSlotOutput(node.name, node.defaultContent, outVarFor(node, outVar))
		case 'SlotVar':
			return Helper.emitSlotVar(node.varName)
		case 'Component': {
			let code = ''
			for (const [slotName, slotIR] of Object.entries(node.slots)) {
				const slotVar = node.slotVarMap[slotName]
				if (slotVar === undefined) continue
				code += Helper.emitSlotVar(slotVar)
				code += emitToJS(slotIR, slotVar)
			}
			const slotsString = Helper.emitSlotsObjectVars(node.slotVarMap)
			const targetVar = outVarFor(node, outVar)
			code += `${targetVar} += await Aero.renderComponent(${node.baseName}, ${node.propsString}, ${slotsString}, ${Helper.getRenderComponentContextArg()});\n`
			return code
		}
		case 'ScriptPassData': {
			let code = ''
			if (!node.isModule) {
				code += Helper.emitAppend('\\n{\\n', node.outVar)
			}
			const jsMapExpr = `Object.entries(${node.passDataExpr}).map(([k, v]) => "\\nconst " + k + " = " + JSON.stringify(v) + ";").join("")`
			code += Helper.emitAppend(`\${${jsMapExpr}}\\n`, node.outVar)
			return code
		}
		case 'StylePassData': {
			const cssMapExpr = `Object.entries(${node.passDataExpr}).map(([k, v]) => "\\n  --" + k + ": " + String(v) + ";").join("")`
			return Helper.emitAppend(`\n:root {\${${cssMapExpr}}\n}\n`, node.outVar)
		}
		default: {
			const _: never = node
			return ''
		}
	}
}

/**
 * Emit body and style IR to JS, and wrap style in a style var + styles?.add().
 * Matches current codegen behavior: bodyCode from body IR, styleCode from style IR.
 */
export function emitBodyAndStyle(ir: BodyAndStyleIR): { bodyCode: string; styleCode: string } {
	const bodyCode = emitToJS(ir.body, DEFAULT_OUT)
	let styleCode = ''
	if (ir.style.length > 0) {
		const styleVar = `__out_style_${Math.random().toString(36).slice(2)}`
		styleCode += `let ${styleVar} = '';\n`
		styleCode += emitToJS(ir.style, styleVar)
		styleCode += `styles?.add(${styleVar});\n`
	}
	return { bodyCode, styleCode }
}
