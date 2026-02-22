import type { ParseResult, CompileOptions } from '../types'
import * as CONST from './constants'
import * as Helper from './helpers'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'

interface ParsedElementAttrs {
	attrString: string
	loopData: { item: string; items: string } | null
	passDataExpr: string | null
}

interface ParsedComponentAttrs {
	propsString: string
}

class Compiler {
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

	compileNode(node: any, skipInterpolation = false, outVar = '__out'): string {
		switch (node.nodeType) {
			case 3:
				return this.compileText(node, skipInterpolation, outVar)
			case 1:
				return this.compileElement(node, skipInterpolation, outVar)
			default:
				return ''
		}
	}

	/** Compiles a list of nodes (e.g. body children) with interpolation enabled. */
	compileFragment(nodes: NodeList | undefined): string {
		return this.compileChildNodes(nodes, false, '__out')
	}

	private compileChildNodes(
		nodes: NodeList | undefined,
		skipInterpolation: boolean,
		outVar: string,
	): string {
		if (!nodes) return ''
		let out = ''
		let i = 0
		while (i < nodes.length) {
			const node = nodes[i]

			// Check if this starts a conditional chain
			if (this.hasIfAttr(node)) {
				const { code, consumed } = this.compileConditionalChain(
					nodes,
					i,
					skipInterpolation,
					outVar,
				)
				out += code
				i += consumed
				continue
			}

			out += this.compileNode(node, skipInterpolation, outVar)
			i++
		}
		return out
	}

	/**
	 * Compiles a conditional chain (if/else-if/else siblings) into proper control flow.
	 * Returns the generated code and how many nodes were consumed.
	 */
	private compileConditionalChain(
		nodes: NodeList,
		startIndex: number,
		skipInterpolation: boolean,
		outVar: string,
	): { code: string; consumed: number } {
		let out = ''
		let i = startIndex
		let isFirst = true

		while (i < nodes.length) {
			const node = nodes[i] as any
			if (!node || node.nodeType !== 1) {
				// Skip text nodes (whitespace) between conditional elements
				if (node?.nodeType === 3 && node.textContent?.trim() === '') {
					i++
					continue
				}
				break
			}

			if (isFirst) {
				// First element must have if
				if (!this.hasIfAttr(node)) break
				const condition = this.getCondition(node, CONST.ATTR_IF)
				out += Helper.emitIf(condition!)
				out += this.compileElement(node, skipInterpolation, outVar)
				out += Helper.emitEnd()
				isFirst = false
				i++
			} else if (this.hasElseIfAttr(node)) {
				// else-if branch
				const condition = this.getCondition(node, CONST.ATTR_ELSE_IF)
				out = out.slice(0, -2) // Remove "}\n" to chain else-if
				out += Helper.emitElseIf(condition!)
				out += this.compileElement(node, skipInterpolation, outVar)
				out += Helper.emitEnd()
				i++
			} else if (this.hasElseAttr(node)) {
				// else branch (final)
				out = out.slice(0, -2) // Remove "}\n" to chain else
				out += Helper.emitElse()
				out += this.compileElement(node, skipInterpolation, outVar)
				out += Helper.emitEnd()
				i++
				break // else is always the last branch
			} else {
				// Not part of the chain
				break
			}
		}

		return { code: out, consumed: i - startIndex }
	}

	private compileText(node: any, skipInterpolation: boolean, outVar: string): string {
		const text = node.textContent || ''
		if (!text) return ''
		const content = skipInterpolation
			? Helper.escapeBackticks(text)
			: Helper.compileInterpolation(text)
		return Helper.emitAppend(content, outVar)
	}

	private compileElement(node: any, skipInterpolation: boolean, outVar: string): string {
		const tagName = node.tagName.toLowerCase()

		if (tagName === CONST.TAG_SLOT) {
			return this.compileSlot(node, skipInterpolation, outVar)
		}

		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponent(node, tagName, skipInterpolation, outVar)
		}

		let out = ''
		const { attrString, loopData, passDataExpr } = this.parseElementAttributes(node)

		// Emit for loop opening
		if (loopData) {
			out += Helper.emitForOf(loopData.item, loopData.items)
		}

		if (CONST.VOID_TAGS.has(tagName)) {
			out += Helper.emitAppend(`<${tagName}${attrString}>`, outVar)
		} else {
		const childSkip = skipInterpolation || tagName === 'style' || (tagName === 'script' && !passDataExpr)
			out += Helper.emitAppend(`<${tagName}${attrString}>`, outVar)

			const isScript = tagName === 'script'
			const isStyle = tagName === 'style'
			let closeBlock = false

			if (isScript && passDataExpr) {
				const result = this.emitScriptPassData(passDataExpr, node, outVar)
				out += result.code
				closeBlock = result.closeBlock
			} else if (isStyle && passDataExpr) {
				out += this.emitStylePassData(passDataExpr, outVar)
			}

			out += this.compileChildNodes(node.childNodes, childSkip, outVar)

			if (closeBlock) {
				out += Helper.emitAppend('\\n}\\n', outVar)
			}

			out += Helper.emitAppend(`</${tagName}>`, outVar)
		}

		// Close for loop
		if (loopData) {
			out += Helper.emitEnd()
		}

		return out
	}

	/**
	 * Emits code that injects `pass:data` variables into a `<script>` tag.
	 * For non-module scripts, wraps the injected constants in a block scope `{ }`.
	 * Each key from the data object becomes a `const k = JSON.stringify(v);` declaration.
	 */
	private emitScriptPassData(
		passDataExpr: string,
		node: any,
		outVar: string,
	): { code: string; closeBlock: boolean } {
		let code = ''
		const isModule = node.getAttribute('type') === 'module'
		let closeBlock = false

		if (!isModule) {
			code += Helper.emitAppend('\\n{\\n', outVar)
			closeBlock = true
		}

		const jsMapExpr = `Object.entries(${passDataExpr}).map(([k, v]) => "\\nconst " + k + " = " + JSON.stringify(v) + ";").join("")`
		code += Helper.emitAppend(`\${${jsMapExpr}}\\n`, outVar)

		return { code, closeBlock }
	}

	/**
	 * Emits code that injects `pass:data` variables into a `<style>` tag
	 * as CSS custom properties within a `:root` block.
	 * Each key becomes `--key: String(value);`.
	 */
	private emitStylePassData(passDataExpr: string, outVar: string): string {
		const cssMapExpr = `Object.entries(${passDataExpr}).map(([k, v]) => "\\n  --" + k + ": " + String(v) + ";").join("")`
		return Helper.emitAppend(`\n:root {\${${cssMapExpr}}\n}\n`, outVar)
	}

	private compileSlot(node: any, skipInterpolation: boolean, outVar: string): string {
		const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
		// Compile default content as template literal content
		const defaultContent = this.compileSlotDefaultContent(node.childNodes, skipInterpolation)
		return Helper.emitSlotOutput(slotName, defaultContent, outVar)
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
			return `\${ await Aero.renderComponent(${baseName}, ${propsString}, {}, { request, url, params, styles, scripts }) }`
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
	): string {
		let out = ''
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = Helper.kebabToCamelCase(kebabBase)
		const { propsString } = this.parseComponentAttributes(node)

		// Compile slot content as statements into captured variables (Hyperspace-style)
		const slotVarMap: Record<string, string> = {}
		const slotContentMap: Record<string, any[]> = { [CONST.SLOT_NAME_DEFAULT]: [] }

		// First pass: categorize children by slot name
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

		// Second pass: compile each slot's content as statements
		for (const [slotName, children] of Object.entries(slotContentMap)) {
			const slotVar = `__slot_${this.slotCounter++}`
			slotVarMap[slotName] = slotVar

			// Emit slot variable declaration
			out += Helper.emitSlotVar(slotVar)

			// Compile children into the slot variable
			for (const child of children) {
				if (child.nodeType === 1) {
					const childTagName = child.tagName?.toLowerCase()

					// Handle slot passthrough: <slot name="x" slot="y">
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
						out += Helper.emitSlotOutput(passthroughName, defaultContent, slotVar)
						continue
					}
				}

				out += this.compileNode(child, skipInterpolation, slotVar)
			}
		}

		const slotsString = Helper.emitSlotsObjectVars(slotVarMap)
		out += `${outVar} += await Aero.renderComponent(${baseName}, ${propsString}, ${slotsString}, { request, url, params, styles, scripts });\n`

		return out
	}
}

export function compile(parsed: ParseResult, options: CompileOptions): string {
	const inlineScripts = options.inlineScripts ?? parsed.inlineScripts

	// Create resolver once and share with compiler
	const resolver = new Resolver({
		root: options.root,
		resolvePath: options.resolvePath,
	})

	const compiler = new Compiler(resolver)

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
				styleCode += `let ${styleVar} = '';\n`
				styleCode += compiler.compileNode(node, false, styleVar)
				styleCode += `styles?.add(${styleVar});\n`
				;(node as any).remove()
			}
		}
	}

	let bodyCode = document.body ? compiler.compileFragment(document.body.childNodes) : ''

	const rootScripts: string[] = []
	const headScripts: string[] = []

	// Process Bundled Client Scripts
	if (options.clientScripts && options.clientScripts.length > 0) {
		for (const clientScript of options.clientScripts) {
			const hasType = clientScript.attrs.includes('type=')
			const baseAttrs = hasType
				? clientScript.attrs
				: `type="module"${clientScript.attrs ? ' ' + clientScript.attrs : ''}`
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

	const renderFn = `export default async function(Aero) {
		const { slots = {}, renderComponent, request, url, params, styles, scripts, headScripts: injectedHeadScripts } = Aero;
		${script}
		${styleCode}
		${rootScripts.length > 0 ? rootScripts.join('\n\t\t') : ''}
		${headScripts.length > 0 ? headScripts.map(s => `injectedHeadScripts?.add(${s});`).join('\n\t\t') : ''}
		let __out = '';
		${bodyCode}return __out;
	}`

	return (
		importsCode +
		'\n' +
		(getStaticPathsFn ? `${getStaticPathsFn}\n\n${renderFn}`.trim() : renderFn.trim())
	)
}
