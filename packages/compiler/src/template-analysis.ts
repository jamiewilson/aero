/**
 * Structured result of parsing and lowering a template before script policy (client/blocking) and render emission.
 *
 * @remarks
 * Single ownership of resolver → build script → DOM → IR for the compile pipeline; feeds `compile()` in codegen.
 */

import { CodeBuilder } from './code-builder'
import type { ParseResult, CompileOptions } from './types'
import type { IRNode } from './ir'
import type { TemplateEditorAmbient } from './template-editor-context'
import { analyzeBuildScript, stripBuildScriptTypes } from './build-script-analysis'
import { emitBodyAndStyle, emitStyleBlock } from './emit'
import { expandSelfClosingTags } from './parser'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'
import { Lowerer } from './lowerer/lowerer'
import { getTemplateEditorAmbientFromParsed } from './template-editor-context'

/**
 * Analysis artifacts for one template: imports, style extraction, body IR, and stripped build script.
 */
export interface TemplateAnalysis {
	readonly importsCode: string
	/** Top-level `<style>` tags compiled into `let __aero_style_n = ''` + `styles?.add(...)`. */
	readonly styleCode: string
	/** Body IR for debugging and downstream consumers (e.g. language server). */
	readonly bodyIR: IRNode[]
	readonly bodyCode: string
	/** Build script after strip + import rewrite prep (no leading import lines). */
	readonly scriptBody: string
	readonly getStaticPathsFn: string | null
	/**
	 * Build-scope names and type slices aligned with {@link parse} — for tooling and LSP ambient preludes.
	 */
	readonly editorAmbient: TemplateEditorAmbient
}

/**
 * Resolver, lower DOM to IR, emit body — shared path for codegen. Does not apply client/blocking script policy.
 */
export function buildTemplateAnalysis(
	parsed: ParseResult,
	options: CompileOptions,
	resolver: Resolver,
	lowerer: Lowerer
): TemplateAnalysis {
	let script = parsed.buildScript ? parsed.buildScript.content : ''

	const analysis = analyzeBuildScript(script)
	script = stripBuildScriptTypes(analysis.scriptWithoutImportsAndGetStaticPaths)
	const getStaticPathsFn = analysis.getStaticPathsFn

	const importsLines: string[] = []
	const quote = '"'
	for (const imp of analysis.imports) {
		const resolved = resolver.resolveImport(imp.specifier)
		const modExpr = `await import(${quote}${resolved}${quote})`
		if (imp.defaultBinding) {
			importsLines.push(`const ${imp.defaultBinding} = (${modExpr}).default`)
		} else if (imp.namedBindings.length > 0) {
			const names = imp.namedBindings
				.map(b => (b.imported === b.local ? b.local : `${b.imported} as ${b.local}`))
				.join(', ')
			importsLines.push(`const {${names}} = ${modExpr}`)
		} else if (imp.namespaceBinding) {
			importsLines.push(`const ${imp.namespaceBinding} = ${modExpr}`)
		}
	}
	const importsBuilder = new CodeBuilder()
	for (let i = 0; i < importsLines.length; i++) {
		if (i > 0) importsBuilder.raw('\n')
		importsBuilder.raw(importsLines[i]!)
	}
	const importsCode = importsBuilder.toString()

	const expandedTemplate = expandSelfClosingTags(parsed.template)

	const { document } = parseHTML(`
		<html lang="en">
			<body>${expandedTemplate}</body>
		</html>
	`)

	let emittedStyleVarId = 0
	function nextStyleVar(): string {
		return `__aero_style_${emittedStyleVarId++}`
	}

	let styleCode = ''
	if (document.body) {
		const children = Array.from(document.body.childNodes)
		for (const node of children) {
			if (node.nodeType === 1 && (node as { tagName?: string }).tagName === 'STYLE') {
				const styleVar = nextStyleVar()
				const styleIR = lowerer.compileNode(node, false, styleVar)
				styleCode += emitStyleBlock(styleIR, styleVar)
				;(node as { remove: () => void }).remove()
			}
		}
	}

	const bodyIR = document.body ? lowerer.compileFragment(document.body.childNodes) : []
	const { bodyCode } = emitBodyAndStyle({ body: bodyIR, style: [] })

	const editorAmbient = getTemplateEditorAmbientFromParsed(parsed)

	return {
		importsCode,
		styleCode,
		bodyIR,
		bodyCode,
		scriptBody: script,
		getStaticPathsFn: getStaticPathsFn || null,
		editorAmbient,
	}
}
