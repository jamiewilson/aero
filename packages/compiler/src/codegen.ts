/**
 * Codegen: compile parsed HTML template and script blocks into an async render function (module source).
 *
 * @remarks
 * Consumes `ParseResult` from the parser and `CompileOptions` (root, resolvePath, script arrays).
 * Resolves imports, extracts getStaticPaths, parses the template with linkedom, and walks the DOM
 * to lower to IR (elements, components, slots, data-for, data-if/else-if/else, script/style props),
 * then a single emitter turns IR → JS. Output is a string of JavaScript (default async render function,
 * optionally preceded by getStaticPaths export).
 */

import type { ParseResult, CompileOptions } from './types'
import * as CONST from './constants'
import * as Helper from './helpers'
import { analyzeBuildScript } from './build-script-analysis'
import { emitToJS, emitBodyAndStyle } from './emit'
import { expandSelfClosingTags, parse } from './parser'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'
import { transformSync } from 'oxc-transform'
import { Lowerer } from './lowerer/lowerer'
let emittedStyleVarId = 0

function nextStyleVar(): string {
	return `__aero_style_${emittedStyleVarId++}`
}

/** Strip TypeScript syntax from a script string, returning plain JavaScript. */
function stripTypes(code: string, filename = 'script.ts'): string {
	if (!code.trim()) return code
	const result = transformSync(filename, code, { typescript: { onlyRemoveTypeImports: true } })
	return result.code.replace(/(?:^|\n)\s*export\s\{\s*\}\s*;?/g, '')
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
	}

	const importsCode = importsLines.join('\n')

	const expandedTemplate = expandSelfClosingTags(parsed.template)

	const { document } = parseHTML(`
		<html lang="en">
			<body>${expandedTemplate}</body>
		</html>
	`)

	let styleCode = ''
	if (document.body) {
		const children = Array.from(document.body.childNodes)
		for (const node of children) {
			if (node.nodeType === 1 && (node as any).tagName === 'STYLE') {
				const styleVar = nextStyleVar()
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

	const renderFn = Helper.emitRenderFunction(script, bodyCode, {
		getStaticPathsFn: getStaticPathsFn || undefined,
		styleCode,
	})

	return importsCode + '\n' + renderFn
}

/**
 * Compile an HTML template source into a JavaScript module string. Single entry for parse + compile.
 */
export function compileTemplate(htmlSource: string, options: CompileOptions): string {
	const parsed = parse(htmlSource)
	return compile(parsed, {
		...options,
		diagnosticTemplateSource: options.diagnosticTemplateSource ?? htmlSource,
	})
}
