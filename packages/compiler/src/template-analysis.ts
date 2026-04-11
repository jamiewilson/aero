/**
 * Structured result of parsing and lowering a template before script policy (client/blocking) and render emission.
 *
 * @remarks
 * Single ownership of resolver → build script → DOM → IR for the compile pipeline; feeds `compile()` in codegen.
 */

import type { IRNode } from './ir'
import type { TemplateEditorAmbient } from './template-editor-context'
import type { CompileOptions, ParseResult } from './types'

import { parseHTML } from 'linkedom'
import { analyzeBuildScript, stripBuildScriptTypes } from './build-script-analysis'
import { emitBodyAndStyle, emitStyleBlock } from './emit'
import { Lowerer } from './lowerer/lowerer'
import { expandSelfClosingTags } from './parser'
import { Resolver } from './resolver'
import { getTemplateEditorAmbientFromParsed } from './template-editor-context'

function buildImportsCode(
	imports: ReturnType<typeof analyzeBuildScript>['imports'],
	resolver: Resolver
): string {
	const importsLines: string[] = []
	for (const imp of imports) {
		const resolved = resolver.resolveImport(imp.specifier)
		const modExpr = `await import("${resolved}")`
		if (imp.defaultBinding) {
			importsLines.push(`const ${imp.defaultBinding} = (${modExpr}).default`)
			continue
		}
		if (imp.namedBindings.length > 0) {
			const names = imp.namedBindings
				.map(b => (b.imported === b.local ? b.local : `${b.imported} as ${b.local}`))
				.join(', ')
			importsLines.push(`const {${names}} = ${modExpr}`)
			continue
		}
		if (imp.namespaceBinding) {
			importsLines.push(`const ${imp.namespaceBinding} = ${modExpr}`)
		}
	}
	return importsLines.join('\n')
}

function isStyleElement(node: Node): node is Element {
	return node.nodeType === 1 && (node as Element).tagName === 'STYLE'
}

function extractTopLevelStyleCode(body: HTMLElement | null, lowerer: Lowerer): string {
	if (!body) return ''
	let emittedStyleVarId = 0
	const nextStyleVar = (): string => `__aero_style_${emittedStyleVarId++}`
	let styleCode = ''
	const children = Array.from(body.childNodes)
	for (const node of children) {
		if (!isStyleElement(node)) continue
		const styleVar = nextStyleVar()
		const styleIR = lowerer.compileNode(node, false, styleVar)
		styleCode += emitStyleBlock(styleIR, styleVar)
		node.remove()
	}
	return styleCode
}

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
	const importsCode = buildImportsCode(analysis.imports, resolver)
	const expandedTemplate = expandSelfClosingTags(parsed.template)
	const { document } = parseHTML(`<html lang="en"><body>${expandedTemplate}</body></html>`)
	const styleCode = extractTopLevelStyleCode(document.body, lowerer)
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
