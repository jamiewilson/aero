import * as CONST from './constants'
import * as Helper from './helpers'
import type { ParseResult, CompileOptions } from '@src/types'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'

class Compiler {
	private resolver: Resolver

	constructor(options: CompileOptions) {
		this.resolver = new Resolver({
			root: options.root,
			resolvePath: options.resolvePath,
		})
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
		if (skipInterpolation) {
			return Helper.escapeBackticks(text)
		}
		return Helper.compileInterpolation(text)
	}

	private compileElement(node: any, skipInterpolation: boolean): string {
		const tagName = node.tagName.toLowerCase()

		if (tagName === CONST.TAG_SLOT) {
			return this.compileSlot(node, skipInterpolation)
		}

		if (CONST.COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponent(node, tagName, skipInterpolation)
		}

		const attributes: string[] = []
		let loopData = null
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
					let condition = attr.value.trim()
					// Strip surrounding braces if present
					if (condition.startsWith('{') && condition.endsWith('}')) {
						condition = condition.slice(1, -1).trim()
					}
					ifCondition = condition
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

		if (CONST.VOID_TAGS.has(tagName)) {
			let elementCode = `<${tagName}${attrString}>`
			if (loopData) {
				elementCode = Helper.emitMapJoin(loopData.items, loopData.item, elementCode)
			}
			if (ifCondition) {
				elementCode = Helper.emitConditional(ifCondition, elementCode)
			}
			return elementCode
		}

		const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
		const children = this.compileChildNodes(node.childNodes, childSkip)
		let elementCode = `<${tagName}${attrString}>${children}</${tagName}>`

		if (loopData) {
			elementCode = Helper.emitMapJoin(loopData.items, loopData.item, elementCode)
		}
		if (ifCondition) {
			elementCode = Helper.emitConditional(ifCondition, elementCode)
		}

		return elementCode
	}

	private compileSlot(node: any, skipInterpolation: boolean): string {
		const slotName = node.getAttribute(CONST.ATTR_NAME) || CONST.SLOT_NAME_DEFAULT
		const defaultContent = this.compileChildNodes(node.childNodes, skipInterpolation)
		return Helper.emitSlotFallback(slotName, defaultContent)
	}

	private compileComponent(node: any, tagName: string, skipInterpolation: boolean): string {
		const kebabBase = tagName.replace(CONST.COMPONENT_SUFFIX_REGEX, '')
		const baseName = kebabBase.replace(/-([a-z])/g, (_, char) => char.toUpperCase())

		const propsEntries: string[] = []
		let dataPropsExpression: string | null = null
		let ifCondition: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (Helper.isAttr(attr.name, CONST.ATTR_EACH, CONST.ATTR_PREFIX)) continue

				if (Helper.isAttr(attr.name, CONST.ATTR_IF, CONST.ATTR_PREFIX)) {
					let condition = attr.value.trim()
					if (condition.startsWith('{') && condition.endsWith('}')) {
						condition = condition.slice(1, -1).trim()
					}
					ifCondition = condition
					continue
				}

				if (Helper.isAttr(attr.name, CONST.ATTR_PROPS, CONST.ATTR_PREFIX)) {
					const value = attr.value?.trim() || ''
					dataPropsExpression = !value
						? '...props'
						: value.startsWith('{') && value.endsWith('}')
							? value.slice(1, -1).trim()
							: `...${value}`
					continue
				}

				let val = Helper.escapeBackticks(attr.value)
				if (val.startsWith('{') && val.endsWith('}')) {
					val = val.substring(1, val.length - 1)
				} else {
					val = `"${val}"`
				}
				propsEntries.push(`${attr.name}: ${val}`)
			}
		}

		let propsString: string
		if (dataPropsExpression) {
			propsString =
				propsEntries.length > 0
					? `{ ${dataPropsExpression}, ${propsEntries.join(', ')} }`
					: `{ ${dataPropsExpression} }`
		} else {
			propsString = `{ ${propsEntries.join(', ')} }`
		}

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
						const defaultContent = this.compileChildNodes(child.childNodes, skipInterpolation)
						const passthroughContent = Helper.emitSlotFallback(passthroughName, defaultContent)

						if (!slotsMap[slotName]) slotsMap[slotName] = ''
						slotsMap[slotName] += passthroughContent
						continue
					}

					// Normal slot attribute handling
					if (slotAttr) slotName = slotAttr
				}

				if (!slotsMap[slotName]) slotsMap[slotName] = ''
				slotsMap[slotName] += this.compileNode(child, skipInterpolation)
			}
		}

		const slotsString = Helper.emitSlotsObject(slotsMap)

		let componentCode = `\${ await tbd.renderComponent(${baseName}, ${propsString}, ${slotsString}) }`
		if (ifCondition) {
			componentCode = Helper.emitConditional(ifCondition, componentCode)
		}
		return componentCode
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

	let templateCode = document.body ? compiler.compileFragment(document.body.childNodes) : ''
	if (options.clientScriptUrl) {
		templateCode += `<script type="module" src="${options.clientScriptUrl}"></script>`
	}
	return Helper.emitRenderFunction(script, templateCode)
}
