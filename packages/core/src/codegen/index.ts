/**
 * Codegen: compile parsed HTML template and script blocks into an async render function (module source).
 *
 * @remarks
 * This is the Aero-specific codegen that extends the base compiler with Vite/Aero features
 * like client scripts, blocking scripts, and the emit-client-script-tag integration.
 */

import type { ParseResult, CompileOptions } from '../types'
import * as Helper from '@aero-js/compiler/helpers'
import { emitToJS, emitBodyAndStyle } from '@aero-js/compiler/emit'
import { Lowerer } from '@aero-js/compiler/lowerer/lowerer'
import { Resolver } from '@aero-js/compiler/resolver'
import { analyzeBuildScript, stripBuildScriptTypes } from '@aero-js/compiler/build-script-analysis'
import { parse } from '@aero-js/compiler/parser'
import { parseHTML } from 'linkedom'
import {
	emitClientScriptTag,
	VIRTUAL_PREFIX as CLIENT_SCRIPT_VIRTUAL_PREFIX,
} from './emit-client-script-tag'
import { VOID_TAGS } from '@aero-js/compiler/constants'
import { escapeTemplateLiteralContent } from './script-escape'

let emittedStyleVarId = 0

function nextStyleVar(): string {
	return `__aero_style_${emittedStyleVarId++}`
}

function isTagNameChar(char: string | undefined): boolean {
	return char !== undefined && /[A-Za-z0-9-]/.test(char)
}

function findTagEnd(html: string, start: number): number {
	let quote: '"' | "'" | null = null

	for (let i = start; i < html.length; i++) {
		const char = html[i]
		if (quote) {
			if (char === quote) quote = null
			continue
		}

		if (char === '"' || char === "'") {
			quote = char
			continue
		}

		if (char === '>') return i
	}

	return -1
}

function findSelfClosingSlash(html: string, tagEnd: number): number {
	let i = tagEnd - 1
	while (i >= 0 && /\s/.test(html[i] ?? '')) i--
	return html[i] === '/' ? i : -1
}

function expandSelfClosingTags(html: string): string {
	let out = ''
	let cursor = 0

	while (cursor < html.length) {
		const tagStart = html.indexOf('<', cursor)
		if (tagStart === -1) {
			out += html.slice(cursor)
			break
		}

		out += html.slice(cursor, tagStart)
		const firstTagChar = html[tagStart + 1]
		if (!isTagNameChar(firstTagChar)) {
			out += '<'
			cursor = tagStart + 1
			continue
		}

		let nameEnd = tagStart + 1
		while (isTagNameChar(html[nameEnd])) nameEnd++
		const tagName = html.slice(tagStart + 1, nameEnd)
		const tagEnd = findTagEnd(html, nameEnd)
		if (tagEnd === -1) {
			out += html.slice(tagStart)
			break
		}

		const selfClosingSlash = findSelfClosingSlash(html, tagEnd)
		if (selfClosingSlash === -1) {
			out += html.slice(tagStart, tagEnd + 1)
			cursor = tagEnd + 1
			continue
		}

		const openingTag = html.slice(tagStart, selfClosingSlash)
		if (VOID_TAGS.has(tagName.toLowerCase())) {
			out += `${openingTag}>`
		} else {
			out += `${openingTag}></${tagName}>`
		}
		cursor = tagEnd + 1
	}

	return out
}

/**
 * Compile a parsed template and options into a JavaScript module string.
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

	const rootScripts: string[] = []
	const headScripts: string[] = []

	// Process Bundled Client Scripts
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
			const strippedContent = stripBuildScriptTypes(blockingScript.content, 'blocking.ts')
			const escapedAttrs = blockingScript.attrs
				? ` ${escapeTemplateLiteralContent(blockingScript.attrs)}`
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
					`\`<script${escapedAttrs}>\${${jsMapExpr}}${escapeTemplateLiteralContent(strippedContent)}</script>\``
				)
			} else {
				const escapedContent = escapeTemplateLiteralContent(strippedContent)
				headScripts.push(`\`<script${escapedAttrs}>${escapedContent}</script>\``)
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
 * Compile an HTML template source into a JavaScript module string.
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
