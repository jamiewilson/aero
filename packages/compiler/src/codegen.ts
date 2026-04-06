/**
 * Codegen: compile parsed HTML template and script blocks into an async render function (module source).
 *
 * @remarks
 * Consumes `ParseResult` from the parser and `CompileOptions` (root, resolvePath, script arrays).
 * Resolves imports, extracts getStaticPaths, parses the template with linkedom, and walks the DOM
 * to lower to IR (elements, components, slots, data-for, data-if/else-if/else, script/style props),
 * then a single emitter turns IR → JS. Aero/Vite adds client scripts, blocking scripts, and virtual
 * client URLs via the same entry (no duplicate pipeline in core).
 */

import type { ParseResult, CompileOptions, CompileWarning } from './types'
import { CodeBuilder } from './code-builder'
import * as Helper from './helpers'
import { stripBuildScriptTypes } from './build-script-analysis'
import { parse } from './parser'
import { Resolver } from './resolver'
import { Lowerer } from './lowerer/lowerer'
import { buildTemplateAnalysis } from './template-analysis'
import { emitClientScriptTag, VIRTUAL_PREFIX } from './emit-client-script-tag'

/**
 * Compile a parsed template and options into a JavaScript module string (default async render function + optional getStaticPaths).
 */
export function compile(parsed: ParseResult, options: CompileOptions): string {
	const resolver = new Resolver({
		root: options.root,
		resolvePath: options.resolvePath,
		importer: options.importer,
	})

	const lowerer = new Lowerer(
		resolver,
		options.diagnosticTemplateSource !== undefined || options.onWarning
			? {
					source: options.diagnosticTemplateSource ?? '',
					file: options.importer,
					onWarning: options.onWarning
						? (warning: CompileWarning) => {
								options.onWarning?.({
									...warning,
									file: options.importer,
								})
							}
						: undefined,
				}
			: undefined
	)

	const ta = buildTemplateAnalysis(parsed, options, resolver, lowerer)
	let script = ta.scriptBody

	const rootScripts: string[] = []
	const headScripts: string[] = []

	const virtualPrefix = VIRTUAL_PREFIX
	const hasVirtualClientScripts =
		options.clientScripts?.some(c => c.content.startsWith(virtualPrefix)) ?? false
	if (hasVirtualClientScripts) {
		script = new CodeBuilder()
			.raw(`function __aeroScriptUrl(p){return '/'+'@aero/client/'+p}\n`)
			.raw(script)
			.toString()
	}
	if (options.clientScripts && options.clientScripts.length > 0) {
		for (const clientScript of options.clientScripts) {
			const { head, root } = emitClientScriptTag(clientScript, virtualPrefix)
			headScripts.push(...head)
			rootScripts.push(...root)
		}
	}

	if (options.blockingScripts) {
		for (const blockingScript of options.blockingScripts) {
			const strippedContent = stripBuildScriptTypes(blockingScript.content, 'blocking.ts')
			const escapedAttrs = blockingScript.attrs
				? ` ${Helper.escapeTemplateLiteralContent(blockingScript.attrs)}`
				: ''
			if (blockingScript.passDataExpr) {
				let blockingPropsNeedle: string | undefined
				if (options.diagnosticTemplateSource && blockingScript.passDataExpr) {
					const src = options.diagnosticTemplateSource
					const expr = blockingScript.passDataExpr
					for (const n of [`props="${expr}"`, `data-props="${expr}"`]) {
						if (src.includes(n)) {
							blockingPropsNeedle = n
							break
						}
					}
				}
				const passDataExpr = Helper.validateSingleBracedExpression(blockingScript.passDataExpr, {
					directive: 'props',
					tagName: 'script',
					diagnosticSource: options.diagnosticTemplateSource,
					diagnosticFile: options.importer,
					positionNeedle: blockingPropsNeedle,
				})
				const jsMapExpr = `Object.entries(${passDataExpr}).map(([k, v]) => "\\nconst " + k + " = " + escapeScriptJson(v) + ";").join("")`
				headScripts.push(
					`\`<script${escapedAttrs}>\${${jsMapExpr}}${Helper.escapeTemplateLiteralContent(strippedContent)}</script>\``
				)
			} else {
				const escapedContent = Helper.escapeTemplateLiteralContent(strippedContent)
				headScripts.push(`\`<script${escapedAttrs}>${escapedContent}</script>\``)
			}
		}
	}

	const renderFn = Helper.emitRenderFunction(script, ta.bodyCode, {
		getStaticPathsFn: ta.getStaticPathsFn || undefined,
		styleCode: ta.styleCode,
		rootScriptsLines: rootScripts,
		headScriptsLines: headScripts,
	})

	return new CodeBuilder().raw(ta.importsCode).raw('\n').raw(renderFn).toString()
}

/**
 * Compile an HTML template source into a JavaScript module string. Single entry for parse + compile.
 */
export function compileTemplate(
	htmlSource: string,
	options: CompileOptions,
	parsed?: ParseResult
): string {
	const p = parsed ?? parse(htmlSource)
	return compile(p, {
		...options,
		diagnosticTemplateSource: options.diagnosticTemplateSource ?? htmlSource,
		clientScripts: options.clientScripts ?? p.clientScripts,
		inlineScripts: options.inlineScripts ?? p.inlineScripts,
		blockingScripts: options.blockingScripts ?? p.blockingScripts,
	})
}
