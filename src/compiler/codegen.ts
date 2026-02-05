import * as CONST from './constants'
import * as Helper from './helpers'
import type { ParseResult, CompileOptions } from '@src/types'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'

interface ParsedElementAttrs {
	attrString: string
	loopData: { item: string; items: string } | null
	ifCondition: string | null
}

interface ParsedComponentAttrs {
	propsString: string
	ifCondition: string | null
}

class Compiler {
	private resolver: Resolver

	constructor(options: CompileOptions) {
		this.resolver = new Resolver({
			root: options.root,
			resolvePath: options.resolvePath,
		})
	}

	/** Parses component attributes, extracting props, data-props, and data-if */
	private parseComponentAttributes(node: any): ParsedComponentAttrs {
		const propsEntries: string[] = []
		let dataPropsExpression: string | null = null
		let ifCondition: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) continue

				if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) {
					ifCondition = Helper.stripBraces(attr.value)
					continue
				}

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
		return { propsString, ifCondition }
	}

	/** Parses element attributes, extracting data-each, data-if, and building the attribute string */
	private parseElementAttributes(node: any): ParsedElementAttrs {
		const attributes: string[] = []
		let loopData: { item: string; items: string } | null = null
		let ifCondition: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) {
					const content = attr.value.replace(CONST.EACH_BRACES_REGEX, '').trim()
					const match = content.match(CONST.EACH_REGEX)
					if (match) loopData = { item: match[1], items: match[2] }
					continue
				}

				if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) {
					ifCondition = Helper.stripBraces(attr.value)
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
		return { attrString, loopData, ifCondition }
	}

	compileNode(node: any, skipInterpolation = false): string {
		switch (node.nodeType) {
			case 3:
				return this.compileText(node, skipInterpolation)
			case 1:
				return this.compileElement(node, skipInterpolation)
			default:
				return ''
		}
	}

	/** Compiles a list of nodes (e.g. body children) with interpolation enabled. */
	compileFragment(nodes: NodeList | undefined): string {
		return this.compileChildNodes(nodes, false)
	}

	private compileChildNodes(nodes: NodeList | undefined, skipInterpolation: boolean): string {
		if (!nodes) return ''
		let out = ''
		for (let i = 0; i < nodes.length; i++) {
			out += this.compileNode(nodes[i], skipInterpolation)
		}
		return out
	}

	private compileText(node: any, skipInterpolation: boolean): string {
		const text = node.textContent || ''
		if (!text) return ''
		const content = skipInterpolation
			? Helper.escapeBackticks(text)
			: Helper.compileInterpolation(text)
		return Helper.emitAppend(content)
	}

	private compileElement(node: any, skipInterpolation: boolean): string {
		const tagName = node.tagName.toLowerCase()

		if (tagName === CONST.TAG_SLOT) {
			return this.compileSlot(node, skipInterpolation)
		}

		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponent(node, tagName, skipInterpolation)
		}

		let out = ''
		const { attrString, loopData, ifCondition } = this.parseElementAttributes(node)

		// Emit if statement opening
		if (ifCondition) {
			out += Helper.emitIf(ifCondition)
		}

		// Emit for loop opening
		if (loopData) {
			out += Helper.emitForOf(loopData.item, loopData.items)
		}

		if (CONST.VOID_TAGS.has(tagName)) {
			out += Helper.emitAppend(`<${tagName}${attrString}>`)
		} else {
			const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
			out += Helper.emitAppend(`<${tagName}${attrString}>`)
			out += this.compileChildNodes(node.childNodes, childSkip)
			out += Helper.emitAppend(`</${tagName}>`)
		}

		// Close for loop
		if (loopData) {
			out += Helper.emitEnd()
		}

		// Close if statement
		if (ifCondition) {
			out += Helper.emitEnd()
		}

		return out
	}

	private compileSlot(node: any, skipInterpolation: boolean): string {
		const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
		// Compile default content as template literal content (not statements)
		const defaultContent = this.compileSlotContent(node.childNodes, skipInterpolation)
		return Helper.emitSlotOutput(slotName, defaultContent)
	}

	/** Compiles nodes into template literal content (for slot defaults and component slot content). */
	private compileSlotContent(nodes: NodeList | undefined, skipInterpolation: boolean): string {
		if (!nodes) return ''
		let out = ''
		for (let i = 0; i < nodes.length; i++) {
			out += this.compileNodeAsContent(nodes[i], skipInterpolation)
		}
		return out
	}

	/** Compiles a single node into template literal content (not statements). */
	private compileNodeAsContent(node: any, skipInterpolation: boolean): string {
		if (node.nodeType === 3) {
			// Text node
			const text = node.textContent || ''
			if (!text) return ''
			return skipInterpolation
				? Helper.escapeBackticks(text)
				: Helper.compileInterpolation(text)
		}
		if (node.nodeType === 1) {
			// Element node
			return this.compileElementAsContent(node, skipInterpolation)
		}
		return ''
	}

	/** Compiles an element into template literal content (for slot content). */
	private compileElementAsContent(node: any, skipInterpolation: boolean): string {
		const tagName = node.tagName.toLowerCase()

		// Handle nested slots within slot content
		if (tagName === CONST.TAG_SLOT) {
			const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
			const defaultContent = this.compileSlotContent(node.childNodes, skipInterpolation)
			return Helper.emitSlotFallback(slotName, defaultContent)
		}

		// Handle component tags within slot content
		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponentAsContent(node, tagName, skipInterpolation)
		}

		const { attrString, loopData, ifCondition } = this.parseElementAttributes(node)

		let elementContent: string
		if (CONST.VOID_TAGS.has(tagName)) {
			elementContent = `<${tagName}${attrString}>`
		} else {
			const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
			const children = this.compileSlotContent(node.childNodes, childSkip)
			elementContent = `<${tagName}${attrString}>${children}</${tagName}>`
		}

		// Wrap with loop if needed
		if (loopData) {
			elementContent = Helper.emitMapJoin(loopData.items, loopData.item, elementContent)
		}

		// Wrap with conditional if needed
		if (ifCondition) {
			elementContent = Helper.emitConditional(ifCondition, elementContent)
		}

		return elementContent
	}

	/** Compiles a component into template literal content (for slot content). */
	private compileComponentAsContent(
		node: any,
		tagName: string,
		skipInterpolation: boolean,
	): string {
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = Helper.kebabToCamelCase(kebabBase)
		const { propsString, ifCondition } = this.parseComponentAttributes(node)

		// Compile slot content as template literal content
		const slotsMap: Record<string, string> = { [CONST.SLOT_NAME_DEFAULT]: '' }
		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i]
				let slotName = CONST.SLOT_NAME_DEFAULT
				if (child.nodeType === 1) {
					const slotAttr = child.getAttribute(CONST.ATTR_SLOT)
					if (slotAttr) slotName = slotAttr
				}
				if (!slotsMap[slotName]) slotsMap[slotName] = ''
				slotsMap[slotName] += this.compileNodeAsContent(child, skipInterpolation)
			}
		}

		const slotsString = Helper.emitSlotsObject(slotsMap)

		// Emit as template interpolation
		let componentContent = `\${ await tbd.renderComponent(${baseName}, ${propsString}, ${slotsString}) }`

		if (ifCondition) {
			componentContent = Helper.emitConditional(ifCondition, componentContent)
		}

		return componentContent
	}

	private compileComponent(node: any, tagName: string, skipInterpolation: boolean): string {
		let out = ''
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = Helper.kebabToCamelCase(kebabBase)
		const { propsString, ifCondition } = this.parseComponentAttributes(node)

		// Compile slot content as template literal content (not statements)
		const slotsMap: Record<string, string> = { [CONST.SLOT_NAME_DEFAULT]: '' }
		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i]
				let slotName = CONST.SLOT_NAME_DEFAULT
				// Check if this is a slot passthrough element
				// A slot with both 'name' and 'slot' attributes passes through from parent to child
				if (child.nodeType === 1) {
					const childTagName = child.tagName?.toLowerCase()
					const slotAttr = child.getAttribute(CONST.ATTR_SLOT)

					// If it's a <slot> element with both 'name' and 'slot' attributes, it's a passthrough
					if (
						childTagName === CONST.TAG_SLOT &&
						child.hasAttribute(CONST.ATTR_NAME) &&
						slotAttr
					) {
						const passthroughName = child.getAttribute(CONST.ATTR_NAME)
						slotName = slotAttr
						const defaultContent = this.compileSlotContent(child.childNodes, skipInterpolation)
						const passthroughContent = Helper.emitSlotFallback(passthroughName, defaultContent)

						if (!slotsMap[slotName]) slotsMap[slotName] = ''
						slotsMap[slotName] += passthroughContent
						continue
					}

					// Normal slot attribute handling
					if (slotAttr) slotName = slotAttr
				}

				if (!slotsMap[slotName]) slotsMap[slotName] = ''
				slotsMap[slotName] += this.compileNodeAsContent(child, skipInterpolation)
			}
		}

		const slotsString = Helper.emitSlotsObject(slotsMap)

		// Emit if statement opening
		if (ifCondition) {
			out += Helper.emitIf(ifCondition)
		}

		// Emit component render call
		out += `__out += await tbd.renderComponent(${baseName}, ${propsString}, ${slotsString});\n`

		// Close if statement
		if (ifCondition) {
			out += Helper.emitEnd()
		}

		return out
	}
}

export function compile(parsed: ParseResult, options: CompileOptions): string {
	// Initialize the resolver separately so we can use it for import resolution before creating the compiler instance
	const resolver = new Resolver({
		root: options.root,
		resolvePath: options.resolvePath,
	})

	const compiler = new Compiler(options)

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
	for (const s of scripts) {
		// Require on:client or on:build for all script tags (except external scripts with src)
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
