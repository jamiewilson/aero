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
import type { CompileOptions, CompileWarning, ParseResult, ScriptEntry } from './types'

import { stripBuildScriptTypes } from './build-script-analysis'
import { CodeBuilder } from './code-builder'
import { emitClientScriptTag, VIRTUAL_PREFIX } from './emit-client-script-tag'
import {
	emitRenderFunction,
	escapeTemplateLiteralContent,
	validateSingleBracedExpression,
} from './helpers'
import { Lowerer } from './lowerer/lowerer'
import { parse } from './parser'
import { Resolver } from './resolver'
import { buildTemplateAnalysis } from './template-analysis'

function addVirtualClientScriptHelper(script: string, clientScripts?: ScriptEntry[]): string {
	const hasVirtualClientScripts =
		clientScripts?.some(clientScript => clientScript.content.startsWith(VIRTUAL_PREFIX)) ?? false

	if (!hasVirtualClientScripts) {
		return script
	}

	return new CodeBuilder()
		.raw(`function __aeroScriptUrl(p){return '/'+'@aero/client/'+p}\n`)
		.raw(script)
		.toString()
}

function collectClientScriptLines(clientScripts?: ScriptEntry[]): {
	rootScripts: string[]
	headScripts: string[]
} {
	const rootScripts: string[] = []
	const headScripts: string[] = []

	if (!clientScripts || clientScripts.length === 0) {
		return { rootScripts, headScripts }
	}

	for (const clientScript of clientScripts) {
		const { head, root } = emitClientScriptTag(clientScript, VIRTUAL_PREFIX)
		headScripts.push(...head)
		rootScripts.push(...root)
	}
	return { rootScripts, headScripts }
}

function findBlockingPropsNeedle(
	source: string | undefined,
	passDataExpr: string
): string | undefined {
	if (!source) return undefined

	for (const needle of [`props="${passDataExpr}"`, `data-props="${passDataExpr}"`]) {
		if (source.includes(needle)) {
			return needle
		}
	}

	return undefined
}

function renderBlockingScriptTag(blockingScript: ScriptEntry, options: CompileOptions): string {
	const strippedContent = stripBuildScriptTypes(blockingScript.content, 'blocking.ts')
	const escapedAttrs = blockingScript.attrs
		? ` ${escapeTemplateLiteralContent(blockingScript.attrs)}`
		: ''

	if (!blockingScript.passDataExpr) {
		const escapedContent = escapeTemplateLiteralContent(strippedContent)
		return `\`<script${escapedAttrs}>${escapedContent}</script>\``
	}

	const blockingPropsNeedle = findBlockingPropsNeedle(
		options.diagnosticTemplateSource,
		blockingScript.passDataExpr
	)

	const passDataExpr = validateSingleBracedExpression(blockingScript.passDataExpr, {
		directive: 'props',
		tagName: 'script',
		diagnosticSource: options.diagnosticTemplateSource,
		diagnosticFile: options.importer,
		positionNeedle: blockingPropsNeedle,
	})

	const jsMapExpr = `Object.entries(${passDataExpr}).map(([k, v]) => "\\nconst " + k + " = " + escapeScriptJson(v) + ";").join("")`

	return `\`<script${escapedAttrs}>\${${jsMapExpr}}${escapeTemplateLiteralContent(strippedContent)}</script>\``
}

function collectBlockingHeadScripts(
	blockingScripts: ScriptEntry[] | undefined,
	options: CompileOptions
): string[] {
	if (!blockingScripts || blockingScripts.length === 0) return []
	return blockingScripts.map(blockingScript => renderBlockingScriptTag(blockingScript, options))
}

/**
 * Compile a parsed template and options into a JavaScript module string (default async render function + optional getStaticPaths).
 */
export function compile(parsed: ParseResult, options: CompileOptions): string {
	const resolver = new Resolver({
		root: options.root,
		resolvePath: options.resolvePath,
		importer: options.importer,
	})

	function buildLowererDiagnostics(options: CompileOptions) {
		if (options.diagnosticTemplateSource === undefined && !options.onWarning) {
			return undefined
		}

		let onWarning: ((warning: CompileWarning) => void) | undefined
		if (options.onWarning) {
			onWarning = (warning: CompileWarning) => {
				options.onWarning?.({
					...warning,
					file: options.importer,
				})
			}
		}

		return {
			source: options.diagnosticTemplateSource ?? '',
			file: options.importer,
			onWarning,
		}
	}

	const lowerer = new Lowerer(resolver, buildLowererDiagnostics(options))

	const ta = buildTemplateAnalysis(parsed, options, resolver, lowerer)
	const script = addVirtualClientScriptHelper(ta.scriptBody, options.clientScripts)
	const { rootScripts, headScripts } = collectClientScriptLines(options.clientScripts)
	headScripts.push(...collectBlockingHeadScripts(options.blockingScripts, options))

	const renderFn = emitRenderFunction(script, ta.bodyCode, {
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
