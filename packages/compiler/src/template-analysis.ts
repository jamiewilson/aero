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
import { CompileError } from './types'
import { analyzeBuildScript, stripBuildScriptTypes, type BuildScriptImport } from './build-script-analysis'
import { collectBuildScopeBindingNames } from './build-scope-bindings'
import { emitBodyAndStyle, emitStyleBlock } from './emit'
import { Lowerer } from './lowerer/lowerer'
import type { LowererDiag } from './lowerer/types'
import { expandSelfClosingTags } from './parser'
import {
	escapeEntityEncodedElementMarkup,
	escapeInterpolationBodyMarkup,
	restoreEntityEncodedElementMarkup,
} from '@aero-js/interpolation'
import { Resolver } from './resolver'
import { getTemplateEditorAmbientFromParsed } from './template-editor-context'
import { analyzeStateScript, stripStateEffectStatements, type StateScriptAnalysisResult } from './state-script-analysis'
import { collectStateReferenceNames } from './lower-state-script'

function buildImportsCode(
	imports: ReturnType<typeof analyzeBuildScript>['imports'],
	resolver: Resolver
): string {
	const importsLines: string[] = []
	for (const imp of imports) {
		const resolved = resolver.resolveImport(imp.specifier)
		const modExpr = `await import("${resolved}")`
		if (imp.defaultBinding) {
			importsLines.push(`const __aeroMod_${imp.defaultBinding} = ${modExpr}`)
			importsLines.push(`const ${imp.defaultBinding} = __aeroMod_${imp.defaultBinding}.default`)
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

/** Undo {@link escapeInterpolationBodyMarkup} in DOM text/attributes before lowering to IR. */
function restoreDomMarkupEscapes(root: Node, restore: (value: string) => string): void {
	const walk = (node: Node): void => {
		if (node.nodeType === 3) {
			const text = node.textContent
			if (text) node.textContent = restore(text)
			return
		}
		if (node.nodeType !== 1) return
		const el = node as Element
		const attrs = el.attributes
		if (attrs) {
			for (let i = 0; i < attrs.length; i++) {
				const attr = attrs[i]
				if (attr) attr.value = restore(attr.value)
			}
		}
		for (let i = 0; i < node.childNodes.length; i++) {
			walk(node.childNodes[i]!)
		}
	}
	walk(root)
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
	/** State script after TS-strip, for SSR initialization/hydration payload emission. */
	readonly stateScriptBody: string
	/** Raw `<script is:state>` source aligned with {@link analyzeStateScript}. */
	readonly stateScriptSource: string
	readonly getStaticPathsFn: string | null
	readonly stateAnalysis: StateScriptAnalysisResult | null
	/** Static imports from `<script is:state>` for client mount scope. */
	readonly stateImports: readonly BuildScriptImport[]
	/** Default import binding names from build/state scripts (for component module refs). */
	readonly defaultImportBindings: ReadonlySet<string>
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
	diag?: LowererDiag
): TemplateAnalysis {
	let script = parsed.buildScript ? parsed.buildScript.content : ''

	const analysis = analyzeBuildScript(script)
	const stateRaw = parsed.stateScript?.content ?? ''
	const stateImportAnalysis = stateRaw ? analyzeBuildScript(stateRaw) : null
	const stateAnalysis = stateRaw ? analyzeStateScript(stateRaw) : null
	if (stateAnalysis && stateAnalysis.diagnostics.length > 0) {
		throw new CompileError({ message: stateAnalysis.diagnostics[0].message, file: options.importer })
	}
	const stateBindingNames = stateAnalysis
		? collectStateReferenceNames(stateRaw, stateAnalysis, stateImportAnalysis?.imports ?? [])
		: undefined
	const writableStateBindingNames = stateAnalysis
		? new Set(
				stateAnalysis.bindings
					.filter(binding => !binding.derived && (!binding.reactiveProp || binding.bindable))
					.map(binding => binding.name)
			)
		: undefined
	const buildScopeNames =
		parsed.buildScript && parsed.buildScript.content.trim().length > 0
			? collectBuildScopeBindingNames([parsed.buildScript.content])
			: undefined
	const lowerer = new Lowerer(resolver, diag, stateBindingNames, {
		writableStateBindingNames,
		buildScopeNames,
		hypermedia: options.hypermedia,
		componentReactiveProps: options.componentReactiveProps,
	})
	script = stripBuildScriptTypes(analysis.scriptWithoutImportsAndGetStaticPaths)
	const stateScriptBody = stateImportAnalysis
		? stripStateEffectStatements(
				stripBuildScriptTypes(stateImportAnalysis.scriptWithoutImportsAndGetStaticPaths, 'state.ts')
			)
		: ''
	const getStaticPathsFn = analysis.getStaticPathsFn
	const importsCode = buildImportsCode(
		[...analysis.imports, ...(stateImportAnalysis?.imports ?? [])],
		resolver
	)
	const defaultImportBindings = new Set(
		[...analysis.imports, ...(stateImportAnalysis?.imports ?? [])]
			.map(imp => imp.defaultBinding)
			.filter((name): name is string => name !== null)
	)
	const { text: expandedTemplate, restore } = escapeInterpolationBodyMarkup(
		escapeEntityEncodedElementMarkup(expandSelfClosingTags(parsed.template))
	)
	const { document } = parseHTML(`<html lang="en"><body>${expandedTemplate}</body></html>`)
	if (document.body) {
		restoreDomMarkupEscapes(document.body, value =>
			restoreEntityEncodedElementMarkup(restore(value))
		)
	}
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
		stateScriptBody,
		stateScriptSource: stateRaw,
		getStaticPathsFn: getStaticPathsFn || null,
		stateAnalysis,
		stateImports: stateImportAnalysis?.imports ?? [],
		defaultImportBindings,
		editorAmbient,
	}
}
