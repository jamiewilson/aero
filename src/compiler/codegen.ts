import type { ParseResult, CompileOptions } from '../types'
import { parseHTML } from 'linkedom'
import { Resolver } from './resolver'
import { compileInterpolation } from './helpers'

const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
])

const ATTR_DATA_EACH = 'data-each'
const ATTR_DATA_PROPS = 'data-props'
const ATTR_NAME = 'name'
const ATTR_SLOT = 'slot'
const ATTR_ON_CLIENT = 'on:client'
const ATTR_ON_BUILD = 'on:build'
const SLOT_DEFAULT = 'default'
const TAG_SLOT = 'slot'

const DATA_EACH_REGEX = /^(\w+)\s+in\s+(.+)$/
const ALPINE_ATTR_REGEX = /^(x-|[@:.]).*/
const CURLY_INTERPOLATION_REGEX = /{([\s\S]+?)}/g
const COMPONENT_SUFFIX_REGEX = /-(component|layout)$/
const DATA_EACH_BRACES_REGEX = /^{|}$/g
const IMPORT_REGEX = /import\s+(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+(['"])(.+?)\4/g
const SELF_CLOSING_TAG_REGEX = /<([a-z0-9-]+)([^>]*?)\/>/gi
const SELF_CLOSING_TAIL_REGEX = /\/>$/

/** Emits code for ${ items.map(item => `body`).join('') } without nested template literal escaping. */
function emitMapJoin(items: string, item: string, body: string): string {
	return '${ ' + items + '.map(' + item + ' => `' + body + "`).join('') }"
}

/** Escapes backticks in a string for safe embedding inside generated template literals. */
function escapeBackticks(s: string): string {
	return s.replace(/`/g, '\\`')
}

/** Emits code for slots['name'] || `defaultContent` without nested template literal escaping. */
function emitSlotFallback(slotName: string, defaultContent: string): string {
	return "${ slots['" + slotName + "'] || `" + defaultContent + '` }'
}

/** Emits code for a slots object { "name": `content` } without nested template literal escaping. */
function emitSlotsObject(slotsMap: Record<string, string>): string {
	const entries = Object.entries(slotsMap)
		.map(([k, v]) => '"' + k + '": `' + v + '`')
		.join(', ')
	return '{ ' + entries + ' }'
}

/** Emits the top-level render function wrapper (script + template return). */
function emitRenderFunction(script: string, templateCode: string): string {
	return `export default async function(tbd) {
		const { site, slots = {}, renderComponent } = tbd;
		${script}
		return \`${templateCode}\`;
	}`.trim()
}

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
			return escapeBackticks(text)
		}
		return compileInterpolation(text)
	}

	private compileElement(node: any, skipInterpolation: boolean): string {
		const tagName = node.tagName.toLowerCase()

		if (tagName === TAG_SLOT) {
			return this.compileSlot(node, skipInterpolation)
		}

		if (COMPONENT_SUFFIX_REGEX.test(tagName)) {
			return this.compileComponent(node, tagName, skipInterpolation)
		}

		const attributes: string[] = []
		let loopData = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (attr.name === ATTR_DATA_EACH) {
					const content = attr.value.replace(DATA_EACH_BRACES_REGEX, '').trim()
					const match = content.match(DATA_EACH_REGEX)
					if (match) loopData = { item: match[1], items: match[2] }
					continue
				}

				let val = escapeBackticks(attr.value)
				val = this.resolver.resolveAttrValue(val)

				const isAlpine = ALPINE_ATTR_REGEX.test(attr.name)
				if (!isAlpine) {
					val = val.replace(CURLY_INTERPOLATION_REGEX, '${$1}')
				}
				attributes.push(`${attr.name}="${val}"`)
			}
		}

		const attrString = attributes.length ? ' ' + attributes.join(' ') : ''

		if (VOID_TAGS.has(tagName)) {
			const elementCode = `<${tagName}${attrString}>`
			if (loopData) {
				return emitMapJoin(loopData.items, loopData.item, elementCode)
			}
			return elementCode
		}

		const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
		const children = this.compileChildNodes(node.childNodes, childSkip)
		const elementCode = `<${tagName}${attrString}>${children}</${tagName}>`

		if (loopData) {
			return emitMapJoin(loopData.items, loopData.item, elementCode)
		}

		return elementCode
	}

	private compileSlot(node: any, skipInterpolation: boolean): string {
		const slotName = node.getAttribute(ATTR_NAME) || SLOT_DEFAULT
		const defaultContent = this.compileChildNodes(node.childNodes, skipInterpolation)
		return emitSlotFallback(slotName, defaultContent)
	}

	private compileComponent(node: any, tagName: string, skipInterpolation: boolean): string {
		const kebabBase = tagName.replace(COMPONENT_SUFFIX_REGEX, '')
		const baseName = kebabBase.replace(/-([a-z])/g, (_, char) => char.toUpperCase())

		const propsEntries: string[] = []
		let dataPropsExpression: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (attr.name === ATTR_DATA_EACH) continue

				if (attr.name === ATTR_DATA_PROPS) {
					const value = attr.value?.trim() || ''
					dataPropsExpression = !value
						? '...props'
						: value.startsWith('{') && value.endsWith('}')
							? value.slice(1, -1).trim()
							: `...${value}`
					continue
				}

				let val = escapeBackticks(attr.value)
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

		const slotsMap: Record<string, string> = { [SLOT_DEFAULT]: '' }
		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i]
				let slotName = SLOT_DEFAULT

				// Check if this is a slot passthrough element
				// A slot with both 'name' and 'slot' attributes passes through from parent to child
				if (child.nodeType === 1) {
					const childTagName = child.tagName?.toLowerCase()
					const slotAttr = child.getAttribute(ATTR_SLOT)

					// If it's a <slot> element with both 'name' and 'slot' attributes, it's a passthrough
					if (childTagName === TAG_SLOT && child.hasAttribute(ATTR_NAME) && slotAttr) {
						const passthroughName = child.getAttribute(ATTR_NAME)
						slotName = slotAttr
						const defaultContent = this.compileChildNodes(child.childNodes, skipInterpolation)
						const passthroughContent = emitSlotFallback(passthroughName, defaultContent)

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

		const slotsString = emitSlotsObject(slotsMap)

		return `\${ await tbd.renderComponent(${baseName}, ${propsString}, ${slotsString}) }`
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

	script = script.replace(IMPORT_REGEX, (m, name, names, starName, q, p) => {
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
		SELF_CLOSING_TAG_REGEX,
		(match, tagName, attrs) => {
			const tag = String(tagName).toLowerCase()
			if (VOID_TAGS.has(tag)) {
				return match.replace(SELF_CLOSING_TAIL_REGEX, '>')
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
			!s.hasAttribute(ATTR_ON_CLIENT) &&
			!s.hasAttribute(ATTR_ON_BUILD) &&
			!s.hasAttribute('src')
		) {
			throw new Error('Script tags must have on:client or on:build attribute.')
		}
	}

	let templateCode = document.body ? compiler.compileFragment(document.body.childNodes) : ''
	if (options.clientScriptUrl) {
		templateCode += `<script type="module" src="${options.clientScriptUrl}"></script>`
	}
	return emitRenderFunction(script, templateCode)
}
