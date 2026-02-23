/**
 * Codegen: compile parsed HTML template and script blocks into an async render function (module source).
 *
 * @remarks
 * Consumes `ParseResult` from the parser and `CompileOptions` (root, resolvePath, script arrays).
 * Resolves imports, extracts getStaticPaths, parses the template with linkedom, and walks the DOM
 * to lower to IR (elements, components, slots, data-each, data-if/else-if/else, script/style pass:data),
 * then a single emitter turns IR → JS. Output is a string of JavaScript (default async render function,
 * optionally preceded by getStaticPaths export).
 */

import type { ParseResult, CompileOptions } from '../types'
import type { IRNode } from './ir'
import * as CONST from './constants'
import * as Helper from './helpers'
import { emitToJS, emitBodyAndStyle } from './emit'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'

/** Result of parsing a generic element's attributes: attribute string for output, optional loop data, optional pass:data expr. */
interface ParsedElementAttrs {
	attrString: string
	loopData: { item: string; items: string } | null
	passDataExpr: string | null
}

/** Result of parsing a component's attributes: props object code string (with optional spread). */
interface ParsedComponentAttrs {
	propsString: string
}

/** Internal lowerer: walks DOM nodes and builds IR; used by compile(). */
class Lowerer {
	private resolver: Resolver
	private slotCounter = 0

	constructor(resolver: Resolver) {
		this.resolver = resolver
	}

	// =========================================================================
	// Conditional chain helpers
	// =========================================================================

	/** Checks if node has if/data-if attribute */
	private hasIfAttr(node: any): boolean {
		return (
			node.nodeType === 1 &&
			(node.hasAttribute(CONST.ATTR_IF) ||
				node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_IF))
		)
	}

	/** Checks if node has else-if/data-else-if attribute */
	private hasElseIfAttr(node: any): boolean {
		return (
			node.nodeType === 1 &&
			(node.hasAttribute(CONST.ATTR_ELSE_IF) ||
				node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_ELSE_IF))
		)
	}

	/** Checks if node has else/data-else attribute */
	private hasElseAttr(node: any): boolean {
		return (
			node.nodeType === 1 &&
			(node.hasAttribute(CONST.ATTR_ELSE) ||
				node.hasAttribute(CONST.ATTR_PREFIX + CONST.ATTR_ELSE))
		)
	}

	/** Gets the condition value from if/else-if attribute */
	private getCondition(node: any, attr: string): string | null {
		const plainValue = node.getAttribute(attr)
		if (plainValue !== null) {
			return this.requireBracedExpression(plainValue, attr, node)
		}

		const dataAttr = CONST.ATTR_PREFIX + attr
		const dataValue = node.getAttribute(dataAttr)
		if (dataValue !== null) {
			return this.requireBracedExpression(dataValue, dataAttr, node)
		}

		return null
	}

	private requireBracedExpression(value: string, directive: string, node: any): string {
		const trimmed = value.trim()
		if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
			const tagName = node?.tagName?.toLowerCase?.() || 'element'
			throw new Error(
				`Directive \`${directive}\` on <${tagName}> must use a braced expression, e.g. ${directive}="{ expression }".`,
			)
		}
		return Helper.stripBraces(trimmed)
	}

	private isSingleWrappedExpression(value: string): boolean {
		const trimmed = value.trim()
		if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
		if (trimmed.startsWith('{{') || trimmed.endsWith('}}')) return false

		let depth = 0
		for (let i = 0; i < trimmed.length; i++) {
			const char = trimmed[i]
			if (char === '{') depth++
			if (char === '}') {
				depth--
				if (depth < 0) return false
				if (depth === 0 && i !== trimmed.length - 1) {
					return false
				}
			}
		}

		return depth === 0
	}

	/** Parses component attributes, extracting props and data-props */
	private parseComponentAttributes(node: any): ParsedComponentAttrs {
		const propsEntries: string[] = []
		let dataPropsExpression: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				// Skip control flow attributes (handled by compileChildNodes)
				if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) continue
				if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) continue
				if (Helper.isAttr(attr.name, CONST.ATTR_ELSE_IF, CONST.ATTR_PREFIX)) continue
				if (Helper.isAttr(attr.name, CONST.ATTR_ELSE, CONST.ATTR_PREFIX)) continue

				if (Helper.isAttr(attr.name, CONST.ATTR_PROPS, CONST.ATTR_PREFIX)) {
					const value = attr.value?.trim() || ''
					if (!value) {
						dataPropsExpression = '...props'
					} else {
						dataPropsExpression = this.requireBracedExpression(value, attr.name, node)
					}
					continue
				}

				const rawValue = attr.value ?? ''
				const escapedLiteral = Helper.escapeBackticks(rawValue)
				let propVal: string

				if (this.isSingleWrappedExpression(rawValue)) {
					propVal = Helper.stripBraces(escapedLiteral)
				} else {
					const compiled = Helper.compileAttributeInterpolation(rawValue)
					const hasInterpolation =
						compiled.includes('${') || rawValue.includes('{{') || rawValue.includes('}}')
					propVal = hasInterpolation ? `\`${compiled}\`` : `"${escapedLiteral}"`
				}

				propsEntries.push(`${attr.name}: ${propVal}`)
			}
		}

		const propsString = Helper.buildPropsString(propsEntries, dataPropsExpression)
		return { propsString }
	}

	/** Parses element attributes, extracting data-each and building the attribute string */
	private parseElementAttributes(node: any): ParsedElementAttrs {
		const attributes: string[] = []
		let loopData: { item: string; items: string } | null = null
		let passDataExpr: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) {
					const content = this.requireBracedExpression(attr.value || '', attr.name, node)
					const match = content.match(CONST.EACH_REGEX)
					if (!match) {
						const tagName = node?.tagName?.toLowerCase?.() || 'element'
						throw new Error(
							`Directive \`${attr.name}\` on <${tagName}> must match "{ item in items }".`,
						)
					}
					loopData = { item: match[1], items: match[2] }
					continue
				}

				// Skip control flow attributes (handled by compileChildNodes)
				if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) continue
				if (Helper.isAttr(attr.name, CONST.ATTR_ELSE_IF, CONST.ATTR_PREFIX)) continue
				if (Helper.isAttr(attr.name, CONST.ATTR_ELSE, CONST.ATTR_PREFIX)) continue

				if (Helper.isAttr(attr.name, CONST.ATTR_PASS_DATA, CONST.ATTR_PREFIX)) {
					passDataExpr = this.requireBracedExpression(attr.value || '', attr.name, node)
					continue
				}

				// Strip is:inline from output (it's a compiler directive, not an HTML attribute)
				if (attr.name === CONST.ATTR_IS_INLINE) {
					continue
				}

				let val = Helper.escapeBackticks(attr.value)
				val = this.resolver.resolveAttrValue(val)

				const isAlpine = CONST.ALPINE_ATTR_REGEX.test(attr.name)
				if (!isAlpine) {
					val = val.replace(CONST.CURLY_INTERPOLATION_REGEX, '${$1}')
				}
				attributes.push(`${attr.name}="${val}"`)
			}
		}

		const attrString = attributes.length ? ' ' + attributes.join(' ') : ''
		return { attrString, loopData, passDataExpr }
	}

	/** Dispatch by node type: text (3) → compileText, element (1) → compileElement; other types return []. */
	compileNode(node: any, skipInterpolation = false, outVar = '__out'): IRNode[] {
		switch (node.nodeType) {
			case 3:
				return this.compileText(node, skipInterpolation, outVar)
			case 1:
				return this.compileElement(node, skipInterpolation, outVar)
			default:
				return []
		}
	}

	/** Lower a list of nodes (e.g. body children) to IR. */
	compileFragment(nodes: NodeList | undefined): IRNode[] {
		return this.compileChildNodes(nodes, false, '__out')
	}

	private compileChildNodes(
		nodes: NodeList | undefined,
		skipInterpolation: boolean,
		outVar: string,
	): IRNode[] {
		if (!nodes) return []
		const out: IRNode[] = []
		let i = 0
		while (i < nodes.length) {
			const node = nodes[i]

			// Check if this starts a conditional chain
			if (this.hasIfAttr(node)) {
				const { nodes: chainNodes, consumed } = this.compileConditionalChain(
					nodes,
					i,
					skipInterpolation,
					outVar,
				)
				out.push(...chainNodes)
				i += consumed
				continue
			}

			out.push(...this.compileNode(node, skipInterpolation, outVar))
			i++
		}
		return out
	}

	/**
	 * Lowers a conditional chain (if/else-if/else siblings) into one IR If node.
	 * Returns the IR and how many DOM nodes were consumed.
	 */
	private compileConditionalChain(
		nodes: NodeList,
		startIndex: number,
		skipInterpolation: boolean,
		outVar: string,
	): { nodes: IRNode[]; consumed: number } {
		let i = startIndex
		let condition: string | null = null
		let body: IRNode[] = []
		const elseIf: { condition: string; body: IRNode[] }[] = []
		let elseBody: IRNode[] | undefined

		while (i < nodes.length) {
			const node = nodes[i] as any
			if (!node || node.nodeType !== 1) {
				if (node?.nodeType === 3 && node.textContent?.trim() === '') {
					i++
					continue
				}
				break
			}

			if (condition === null) {
				// First element must have if
				if (!this.hasIfAttr(node)) break
				condition = this.getCondition(node, CONST.ATTR_IF)!
				body = this.compileElement(node, skipInterpolation, outVar)
				i++
			} else if (this.hasElseIfAttr(node)) {
				const elseIfCondition = this.getCondition(node, CONST.ATTR_ELSE_IF)!
				elseIf.push({ condition: elseIfCondition, body: this.compileElement(node, skipInterpolation, outVar) })
				i++
			} else if (this.hasElseAttr(node)) {
				elseBody = this.compileElement(node, skipInterpolation, outVar)
				i++
				break
			} else {
				break
			}
		}

		const ifNode: IRNode = {
			kind: 'If',
			condition: condition!,
			body,
			...(elseIf.length > 0 && { elseIf }),
			...(elseBody && elseBody.length > 0 && { else: elseBody }),
		}
		return { nodes: [ifNode], consumed: i - startIndex }
	}

	private compileText(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const text = node.textContent || ''
		if (!text) return []
		const content = skipInterpolation
			? Helper.escapeBackticks(text)
			: Helper.compileInterpolation(text)
		return [{ kind: 'Append', content, outVar }]
	}

	/** Lower one element: slot, component (-component/-layout), or regular HTML (with optional data-each, pass:data). */
	private compileElement(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const tagName = node.tagName.toLowerCase()

		if (tagName === CONST.TAG_SLOT) {
			return this.compileSlot(node, skipInterpolation, outVar)
		}

		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponent(node, tagName, skipInterpolation, outVar)
		}

		const { attrString, loopData, passDataExpr } = this.parseElementAttributes(node)
		const childSkip = skipInterpolation || tagName === 'style' || (tagName === 'script' && !passDataExpr)

		const inner: IRNode[] = []

		if (CONST.VOID_TAGS.has(tagName)) {
			inner.push({ kind: 'Append', content: `<${tagName}${attrString}>`, outVar })
		} else {
			inner.push({ kind: 'Append', content: `<${tagName}${attrString}>`, outVar })

			const isScript = tagName === 'script'
			const isStyle = tagName === 'style'
			let closeBlock = false

			if (isScript && passDataExpr) {
				const result = this.emitScriptPassDataIR(passDataExpr, node, outVar)
				inner.push(...result.nodes)
				closeBlock = result.closeBlock
			} else if (isStyle && passDataExpr) {
				inner.push({ kind: 'StylePassData', passDataExpr, outVar })
			}

			inner.push(...this.compileChildNodes(node.childNodes, childSkip, outVar))

			if (closeBlock) {
				inner.push({ kind: 'Append', content: '\\n}\\n', outVar })
			}

			inner.push({ kind: 'Append', content: `</${tagName}>`, outVar })
		}

		if (loopData) {
			return [{ kind: 'For', item: loopData.item, items: loopData.items, body: inner }]
		}
		return inner
	}

	/**
	 * Builds IR for injecting `pass:data` into a `<script>` tag.
	 * For non-module scripts, the emitter emits the opening `{\n`; caller must append closing `}\n` (Append IR).
	 */
	private emitScriptPassDataIR(
		passDataExpr: string,
		node: any,
		outVar: string,
	): { nodes: IRNode[]; closeBlock: boolean } {
		const isModule = node.getAttribute('type') === 'module'
		const nodes: IRNode[] = [{ kind: 'ScriptPassData', passDataExpr, isModule, outVar }]
		return { nodes, closeBlock: !isModule }
	}

	private compileSlot(node: any, skipInterpolation: boolean, outVar: string): IRNode[] {
		const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
		const defaultContent = this.compileSlotDefaultContent(node.childNodes, skipInterpolation)
		return [{ kind: 'Slot', name: slotName, defaultContent, outVar }]
	}

	/** Compiles slot default content into template literal content (for simple fallbacks). */
	private compileSlotDefaultContent(
		nodes: NodeList | undefined,
		skipInterpolation: boolean,
	): string {
		if (!nodes) return ''
		let out = ''
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i] as any
			if (!node) continue
			if (node.nodeType === 3) {
				// Text node
				const text = node.textContent || ''
				if (text) {
					out += skipInterpolation
						? Helper.escapeBackticks(text)
						: Helper.compileInterpolation(text)
				}
			} else if (node.nodeType === 1) {
				// Element node - compile as simple content
				out += this.compileElementDefaultContent(node, skipInterpolation)
			}
		}
		return out
	}

	/** Compiles an element for slot default content (template literal format). */
	private compileElementDefaultContent(node: any, skipInterpolation: boolean): string {
		const tagName = node.tagName.toLowerCase()

		// For nested slots in default content, use inline fallback
		if (tagName === CONST.TAG_SLOT) {
			const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
			const defaultContent = this.compileSlotDefaultContent(node.childNodes, skipInterpolation)
			// make this easier to read without string interpolation
			return `\${ slots['${slotName}'] ?? ${defaultContent} }`
		}

		// For components in default content, use inline render
		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
			const baseName = Helper.kebabToCamelCase(kebabBase)
			const { propsString } = this.parseComponentAttributes(node)
			return `\${ await Aero.renderComponent(${baseName}, ${propsString}, {}, { request, url, params, site: __aero_site, styles, scripts }) }`
		}

		const { attrString } = this.parseElementAttributes(node)

		if (CONST.VOID_TAGS.has(tagName)) {
			return `<${tagName}${attrString}>`
		}

		const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
		const children = this.compileSlotDefaultContent(node.childNodes, childSkip)
		return `<${tagName}${attrString}>${children}</${tagName}>`
	}

	private compileComponent(
		node: any,
		tagName: string,
		skipInterpolation: boolean,
		outVar: string,
	): IRNode[] {
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = Helper.kebabToCamelCase(kebabBase)
		const { propsString } = this.parseComponentAttributes(node)

		const slotVarMap: Record<string, string> = {}
		const slotContentMap: Record<string, any[]> = { [CONST.SLOT_NAME_DEFAULT]: [] }

		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i]
				let slotName = CONST.SLOT_NAME_DEFAULT
				if (child.nodeType === 1) {
					const slotAttr = child.getAttribute(CONST.ATTR_SLOT)
					if (slotAttr) slotName = slotAttr
				}
				slotContentMap[slotName] = slotContentMap[slotName] || []
				slotContentMap[slotName]!.push(child)
			}
		}

		const slots: Record<string, IRNode[]> = {}
		for (const [slotName, children] of Object.entries(slotContentMap)) {
			const slotVar = `__slot_${this.slotCounter++}`
			slotVarMap[slotName] = slotVar

			const slotIR: IRNode[] = []
			for (const child of children) {
				if (child.nodeType === 1) {
					const childTagName = child.tagName?.toLowerCase()
					if (
						childTagName === CONST.TAG_SLOT &&
						child.hasAttribute(CONST.ATTR_NAME) &&
						child.hasAttribute(CONST.ATTR_SLOT)
					) {
						const passthroughName = child.getAttribute(CONST.ATTR_NAME)
						const defaultContent = this.compileSlotDefaultContent(
							child.childNodes,
							skipInterpolation,
						)
						slotIR.push({ kind: 'Slot', name: passthroughName, defaultContent, outVar: slotVar })
						continue
					}
				}
				slotIR.push(...this.compileNode(child, skipInterpolation, slotVar))
			}
			slots[slotName] = slotIR
		}

		return [
			{
				kind: 'Component',
				baseName,
				propsString,
				slots,
				slotVarMap,
				outVar,
			},
		]
	}
}

/**
 * Compile a parsed template and options into a JavaScript module string (default async render function + optional getStaticPaths).
 *
 * @param parsed - Result from parser (buildScript, clientScripts, inlineScripts, blockingScripts, template).
 * @param options - Root, resolvePath, and optional overrides for client/inline/blocking script arrays.
 * @returns Module source: optional getStaticPaths export and default async function(Aero) that returns HTML string.
 */
export function compile(parsed: ParseResult, options: CompileOptions): string {
	const inlineScripts = options.inlineScripts ?? parsed.inlineScripts

	const resolver = new Resolver({
		root: options.root,
		resolvePath: options.resolvePath,
	})

	const lowerer = new Lowerer(resolver)

	let script = parsed.buildScript ? parsed.buildScript.content : ''

	const imports: string[] = []
	script = script.replace(CONST.IMPORT_REGEX, (m, prefix, name, names, starName, q, p) => {
		const resolved = resolver.resolveImport(p)
		if (name) {
			imports.push(`const ${name} = (await import(${q}${resolved}${q})).default`)
		} else if (names) {
			imports.push(`const {${names}} = await import(${q}${resolved}${q})`)
		} else if (starName) {
			imports.push(`const ${starName} = await import(${q}${resolved}${q})`)
		}
		return prefix
	})

	const importsCode = imports.join('\n')

	// Extract getStaticPaths before inlining into the render function.
	// This function is emitted as a separate named module export so the
	// build system can call it to expand dynamic routes.
	const { fnText: getStaticPathsFn, remaining: scriptWithoutPaths } =
		Helper.extractGetStaticPaths(script)
	script = scriptWithoutPaths

	const expandedTemplate = parsed.template.replace(
		CONST.SELF_CLOSING_TAG_REGEX,
		(match, tagName, attrs) => {
			const tag = String(tagName).toLowerCase()
			if (CONST.VOID_TAGS.has(tag)) {
				return match.replace(CONST.SELF_CLOSING_TAIL_REGEX, '>')
			}
			return `<${tagName}${attrs}></${tagName}>`
		},
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
	if (options.clientScripts && options.clientScripts.length > 0) {
		for (const clientScript of options.clientScripts) {
			const attrs = clientScript.attrs ?? ''
			const hasType = attrs.includes('type=')
			const baseAttrs = hasType ? attrs : `type="module"${attrs ? ' ' + attrs : ''}`
			const moduleTag = `<script ${baseAttrs} src="${clientScript.content}"></script>`

			if (clientScript.passDataExpr) {
				// Module scripts run deferred so document.currentScript is null; use an inline
				// bridge script that runs immediately and sets window.__aero_data_next for the module to read.
				const jsonExpr = `JSON.stringify(${Helper.stripBraces(clientScript.passDataExpr)})`
				rootScripts.push(
					`(function(){const __pid=Aero.nextPassDataId();scripts?.add(\`<script type="application/json" id="\${__pid}" class="__aero_data">\${${jsonExpr}}</script>\`);scripts?.add(\`<script>window.__aero_data_next=JSON.parse(document.getElementById("\${__pid}").textContent);</script>\`);scripts?.add(${JSON.stringify(moduleTag)});})();`,
				)
			} else {
				rootScripts.push(`scripts?.add(${JSON.stringify(moduleTag)});`)
			}
		}
	}

	// Process Blocking Scripts (Hoisted to Head)
	if (options.blockingScripts) {
		for (const blockingScript of options.blockingScripts) {
			if (blockingScript.passDataExpr) {
				const trimmed = blockingScript.passDataExpr.trim()
				if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
					throw new Error(
						`Directive \`pass:data\` on <script> must use a braced expression, e.g. pass:data="{ { expression } }".`,
					)
				}
				const jsMapExpr = `Object.entries(${Helper.stripBraces(blockingScript.passDataExpr)}).map(([k, v]) => "\\nconst " + k + " = " + JSON.stringify(v) + ";").join("")`
				headScripts.push(
					`\`<script${blockingScript.attrs ? ' ' + blockingScript.attrs : ''}>\${${jsMapExpr}}${blockingScript.content.replace(/`/g, '\\`')}</script>\``,
				)
			} else {
				const escapedContent = blockingScript.content.replace(/'/g, "\\'")
				headScripts.push(
					`'<script${blockingScript.attrs ? ' ' + blockingScript.attrs : ''}>${escapedContent}</script>'`,
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
