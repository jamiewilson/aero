/**
 * Codegen: compile parsed HTML template and script blocks into an async render function (module source).
 *
 * @remarks
 * Consumes `ParseResult` from the parser and `CompileOptions` (root, resolvePath, script arrays).
 * Resolves imports, extracts getStaticPaths, parses the template with linkedom, and walks the DOM
 * to lower to IR (elements, components, slots, data-each, data-if/else-if/else, script/style props),
 * then a single emitter turns IR → JS. Output is a string of JavaScript (default async render function,
 * optionally preceded by getStaticPaths export).
 */

import type { ParseResult, CompileOptions } from '../types'
import * as CONST from './constants'
import * as Helper from './helpers'
import { analyzeBuildScript } from './build-script-analysis'
import { emitToJS, emitBodyAndStyle } from './emit'
import { parse } from './parser'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'
import { transformSync } from 'oxc-transform'
import {
	emitClientScriptTag,
	VIRTUAL_PREFIX as CLIENT_SCRIPT_VIRTUAL_PREFIX,
} from './emit-client-script-tag'
import { Lowerer } from './lowerer/lowerer'

/** Strip TypeScript syntax from a script string, returning plain JavaScript. */
function stripTypes(code: string, filename = 'script.ts'): string {
	if (!code.trim()) return code
	const result = transformSync(filename, code, { typescript: { onlyRemoveTypeImports: true } })
	return result.code.replace(/(?:^|\n)\s*export\s*\{\s*\}\s*;?/g, '')
}

/**
 * Compile a parsed template and options into a JavaScript module string (default async render function + optional getStaticPaths).
 *
 * @param parsed - Result from parser (buildScript, clientScripts, inlineScripts, blockingScripts, template).
 * @param options - Root, resolvePath, and optional overrides for client/inline/blocking script arrays.
 * @returns Module source: optional getStaticPaths export and default async function(Aero) that returns HTML string.
 */
export function compile(parsed: ParseResult, options: CompileOptions): string {
	const _inlineScripts = options.inlineScripts ?? parsed.inlineScripts

	const resolver = new Resolver({
		root: options.root,
		resolvePath: options.resolvePath,
		importer: options.importer,
	})

	const lowerer = new Lowerer(
		resolver,
		options.diagnosticTemplateSource !== undefined
			? { source: options.diagnosticTemplateSource, file: options.importer }
			: undefined
	)

	let script = parsed.buildScript ? parsed.buildScript.content : ''

	const analysis = analyzeBuildScript(script)
	script = stripTypes(analysis.scriptWithoutImportsAndGetStaticPaths)
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
		// Side-effect-only imports: no bindings to emit
	}
	const importsCode = importsLines.join('\n')

	const expandedTemplate = parsed.template.replace(
		CONST.SELF_CLOSING_TAG_REGEX,
		(match, tagName, attrs) => {
			const tag = String(tagName).toLowerCase()
			if (CONST.VOID_TAGS.has(tag)) {
				return match.replace(CONST.SELF_CLOSING_TAIL_REGEX, '>')
			}
			return `<${tagName}${attrs}></${tagName}>`
		}
	)

	const { document } = parseHTML(`
		<html lang="en">
			<body>${expandedTemplate}</body>
		</html>
	`)

	// Note: We no longer validate `is:*` attributes here because `parser.ts`
	// already completely removed/categorized them before we hit this step.
	// Any remaining `<script>` tags in the AST are guaranteed to be `is:inline`
	// or unhandled `<head>` scripts, which is perfectly fine.

	let styleCode = ''
	if (document.body) {
		const children = Array.from(document.body.childNodes)
		for (const node of children) {
			if (node.nodeType === 1 && (node as any).tagName === 'STYLE') {
				const styleVar = `__out_style_${Math.random().toString(36).slice(2)}`
				const styleIR = lowerer.compileNode(node, false, styleVar)
				styleCode += `let ${styleVar} = '';\n`
				styleCode += emitToJS(styleIR, styleVar)
				styleCode += `styles?.add(${styleVar});\n`
				;(node as any).remove()
			}
		}
	}

	const bodyIR = document.body ? lowerer.compileFragment(document.body.childNodes) : []
	const { bodyCode } = emitBodyAndStyle({ body: bodyIR, style: [] })

	const rootScripts: string[] = []
	const headScripts: string[] = []

	// Process Bundled Client Scripts
	// Virtual client URLs: use helper + string concatenation so no "${}" appears in script tag (vite:build-html would otherwise resolve it as a module).
	const virtualPrefix = CLIENT_SCRIPT_VIRTUAL_PREFIX
	const hasVirtualClientScripts =
		options.clientScripts?.some(c => c.content.startsWith(virtualPrefix)) ?? false
	if (hasVirtualClientScripts) {
		script = `function __aeroScriptUrl(p){return '/'+'@aero/client/'+p}\n` + script
	}
	if (options.clientScripts && options.clientScripts.length > 0) {
		for (const clientScript of options.clientScripts) {
			const { head, root } = emitClientScriptTag(clientScript, virtualPrefix)
			headScripts.push(...head)
			rootScripts.push(...root)
		}
	}

	// Process Blocking Scripts (Hoisted to Head)
	if (options.blockingScripts) {
		for (const blockingScript of options.blockingScripts) {
			const strippedContent = stripTypes(blockingScript.content, 'blocking.ts')
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
				const jsMapExpr = `Object.entries(${passDataExpr}).map(([k, v]) => "\\nconst " + k + " = " + JSON.stringify(v) + ";").join("")`
				headScripts.push(
					`\`<script${blockingScript.attrs ? ' ' + blockingScript.attrs : ''}>\${${jsMapExpr}}${strippedContent.replace(/`/g, '\\`')}</script>\``
				)
			} else {
				const escapedContent = strippedContent.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
				headScripts.push(
					`\`<script${blockingScript.attrs ? ' ' + blockingScript.attrs : ''}>${escapedContent}</script>\``
				)
			}
		}
	}

	const renderFn = Helper.emitRenderFunction(script, bodyCode, {
		getStaticPathsFn: getStaticPathsFn || undefined,
		styleCode,
		rootScriptsLines: rootScripts,
		headScriptsLines: headScripts,
	})

	return importsCode + '\n' + renderFn
}

/**
 * Compile an HTML template source into a JavaScript module string. Single entry for parse + compile.
 * When optional `parsed` is provided (e.g. after registering client scripts in the plugin), it is used to avoid parsing twice.
 *
 * @param htmlSource - Raw HTML template string.
 * @param options - CompileOptions (root, resolvePath, importer, optional script overrides).
 * @param parsed - Optional pre-parsed result; when provided, used instead of parsing htmlSource again.
 * @returns Module source (async render function + optional getStaticPaths).
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
