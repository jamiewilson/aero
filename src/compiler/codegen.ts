import * as CONST from './constants'
import * as Helper from './helpers'
import type { ParseResult, CompileOptions } from '@src/types'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'

interface ParsedElementAttrs {
	attrString: string
	loopData: { item: string; items: string } | null
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
		const value = node.getAttribute(attr) || node.getAttribute(CONST.ATTR_PREFIX + attr)
		return value ? Helper.stripBraces(value) : null
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
					dataPropsExpression = !value
						? '...props'
						: value.startsWith('{') && value.endsWith('}')
							? Helper.stripBraces(value)
							: `...${value}`
					continue
				}

				const val = Helper.escapeBackticks(attr.value)
				const propVal =
					val.startsWith('{') && val.endsWith('}') ? Helper.stripBraces(val) : `"${val}"`
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

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) {
					const content = attr.value.replace(CONST.EACH_BRACES_REGEX, '').trim()
					const match = content.match(CONST.EACH_REGEX)
					if (match) loopData = { item: match[1], items: match[2] }
					continue
				}

				// Skip control flow attributes (handled by compileChildNodes)
				if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) continue
				if (Helper.isAttr(attr.name, CONST.ATTR_ELSE_IF, CONST.ATTR_PREFIX)) continue
				if (Helper.isAttr(attr.name, CONST.ATTR_ELSE, CONST.ATTR_PREFIX)) continue

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
		return { attrString, loopData }
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
		const { attrString, loopData } = this.parseElementAttributes(node)

		// Emit for loop opening
		if (loopData) {
			out += Helper.emitForOf(loopData.item, loopData.items)
		}

		if (CONST.VOID_TAGS.has(tagName)) {
			out += Helper.emitAppend(`<${tagName}${attrString}>`, outVar)
		} else {
			const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
			out += Helper.emitAppend(`<${tagName}${attrString}>`, outVar)
			out += this.compileChildNodes(node.childNodes, childSkip, outVar)
			out += Helper.emitAppend(`</${tagName}>`, outVar)
		}

		// Close for loop
		if (loopData) {
			out += Helper.emitEnd()
		}

		return out
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
			return `\${ await tbd.renderComponent(${baseName}, ${propsString}, {}) }`
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
		out += `${outVar} += await tbd.renderComponent(${baseName}, ${propsString}, ${slotsString});\n`

		return out
	}
}

export function compile(parsed: ParseResult, options: CompileOptions): string {
	// Create resolver once and share with compiler
	const resolver = new Resolver({
		root: options.root,
		resolvePath: options.resolvePath,
	})

	const compiler = new Compiler(resolver)

	let script = parsed.buildScript ? parsed.buildScript.content : ''

	script = script.replace(CONST.IMPORT_REGEX, (m, name, names, starName, q, p) => {
		const resolved = resolver.resolveImport(p)
		if (name) {
			return `const ${name} = (await import(${q}${resolved}${q})).default`
		} else if (names) {
			return `const {${names}} = await import(${q}${resolved}${q})`
		} else if (starName) {
			return `const ${starName} = await import(${q}${resolved}${q})`
		}
		return m
	})

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

	const scripts = document.querySelectorAll('script')
	// Require on:client or on:build for all script tags (except external scripts with src and script tags inside <head>)
	for (const s of scripts) {
		if (s.parentElement?.tagName === 'HEAD') continue
		if (
			!s.hasAttribute(CONST.ATTR_ON_CLIENT) &&
			!s.hasAttribute(CONST.ATTR_ON_BUILD) &&
			!s.hasAttribute('src')
		) {
			throw new Error('Script tags must have on:client or on:build attribute.')
		}
	}

	let bodyCode = document.body ? compiler.compileFragment(document.body.childNodes) : ''
	if (options.clientScriptUrl) {
		bodyCode += Helper.emitAppend(
			`<script type="module" src="${options.clientScriptUrl}"></script>`,
		)
	}
	return Helper.emitRenderFunction(script, bodyCode)
}
