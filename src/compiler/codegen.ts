import type { ParseResult } from './parser'
import { parseHTML } from 'linkedom'
import path from 'path'

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

export interface CompileOptions {
	appDir: string
	root: string
	clientScriptUrl?: string
	resolvePath?: (specifier: string) => string
}

class Compiler {
	private appDir: string
	private root: string
	private resolvePathFn: (specifier: string) => string

	constructor(options: CompileOptions) {
		this.appDir = options.appDir
		this.root = options.root
		this.resolvePathFn = options.resolvePath || ((v: string) => v)
	}

	private normalizeResolved(next: string): string {
		if (path.isAbsolute(next)) {
			next = '/' + path.relative(this.root, next)
		}
		return next.replace(/\\/g, '/')
	}

	resolveImport(specifier: string): string {
		let next = this.resolvePathFn(specifier)
		const looksPath = /^(\.{1,2}\/|\/|@|~)/.test(next)
		if (!looksPath) return specifier

		next = this.normalizeResolved(next)

		const hasExt = path.extname(next) !== ''
		const canAutoHtml = !hasExt && !next.endsWith('/') && !next.includes('?')
		if (canAutoHtml) {
			next = `${next}.html`
		}
		return next
	}

	private resolveAttrValue(value: string): string {
		let next = this.resolvePathFn(value)
		const looksPath = /^(\.{1,2}\/|\/|@|~)/.test(next)
		if (!looksPath) return value
		next = this.normalizeResolved(next)
		return next
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

	private compileText(node: any, skipInterpolation: boolean): string {
		let text = node.textContent || ''
		text = text.replace(/`/g, '\\`')
		if (!skipInterpolation) {
			text = text.replace(/{([\s\S]+?)}/g, '${$1}')
		}
		return text
	}

	private compileElement(node: any, skipInterpolation: boolean): string {
		const tagName = node.tagName.toLowerCase()

		if (tagName === 'slot') {
			return this.compileSlot(node, skipInterpolation)
		}

		if (tagName.endsWith('-component') || tagName.endsWith('-layout')) {
			return this.compileComponent(node, tagName, skipInterpolation)
		}

		const attributes: string[] = []
		let loopData = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (attr.name === 'data-for') {
					const content = attr.value.replace(/^{|}$/g, '').trim()
					const match = content.match(/^(\w+)\s+in\s+(.+)$/)
					if (match) loopData = { item: match[1], items: match[2] }
					continue
				}

				let val = attr.value.replace(/`/g, '\\`')
				val = this.resolveAttrValue(val)

				const isAlpine = /^(x-|[@:.]).*/.test(attr.name)
				if (!isAlpine) {
					val = val.replace(/{([\s\S]+?)}/g, '${$1}')
				}
				attributes.push(`${attr.name}="${val}"`)
			}
		}

		const attrString = attributes.length ? ' ' + attributes.join(' ') : ''

		if (VOID_TAGS.has(tagName)) {
			const elementCode = `<${tagName}${attrString}>`
			if (loopData) {
				return `\${ ${loopData.items}.map(${loopData.item} => \
\`${elementCode}\
\`).join('') }`
			}
			return elementCode
		}

		let children = ''
		if (node.childNodes) {
			const childSkip = skipInterpolation || tagName === 'style' || tagName === 'script'
			for (let i = 0; i < node.childNodes.length; i++) {
				children += this.compileNode(node.childNodes[i], childSkip)
			}
		}

		const elementCode = `<${tagName}${attrString}>${children}</${tagName}>`

		if (loopData) {
			return `\${ ${loopData.items}.map(${loopData.item} => \`${elementCode}\`).join('') }`
		}

		return elementCode
	}

	private compileSlot(node: any, skipInterpolation: boolean): string {
		const slotName = node.getAttribute('name') || 'default'
		let defaultContent = ''
		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				defaultContent += this.compileNode(node.childNodes[i], skipInterpolation)
			}
		}
		return `\${slots['${slotName}'] || \`${defaultContent}\`}`
	}

	private compileComponent(node: any, tagName: string, skipInterpolation: boolean): string {
		const kebabBase = tagName.replace(/-(component|layout)$/, '')
		const baseName = kebabBase.replace(/-([a-z])/g, (_, char) => char.toUpperCase())

		const propsEntries: string[] = []
		let dataPropsExpression: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (attr.name === 'data-for') continue

				if (attr.name === 'data-props') {
					const value = attr.value?.trim() || ''
					if (!value) {
						dataPropsExpression = '...props'
					} else if (value.startsWith('{') && value.endsWith('}')) {
						const inner = value.slice(1, -1).trim()
						if (inner.startsWith('...')) {
							dataPropsExpression = inner
						} else {
							dataPropsExpression = inner
						}
					} else {
						dataPropsExpression = `...${value}`
					}
					continue
				}

				let val = attr.value.replace(/`/g, '\\`')
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

		const slotsMap: Record<string, string> = { default: '' }
		if (node.childNodes) {
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i]
				let slotName = 'default'
				if (child.nodeType === 1) {
					const attr = child.getAttribute('slot')
					if (attr) slotName = attr
				}
				if (!slotsMap[slotName]) slotsMap[slotName] = ''
				slotsMap[slotName] += this.compileNode(child, skipInterpolation)
			}
		}

		const slotsString = `{ ${Object.entries(slotsMap)
			.map(([k, v]) => `${k}: \`${v}\``)
			.join(', ')} }`

		return `\${ await tbd.renderComponent(${baseName}, ${propsString}, ${slotsString}) }`
	}
}

export function compile(parsed: ParseResult, options: CompileOptions): string {
	const compiler = new Compiler(options)

	let script = parsed.buildScript ? parsed.buildScript.content : ''

	const importRegex = /import\s+(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+(['"])(.+?)\4/g
	script = script.replace(importRegex, (m, name, names, starName, q, p) => {
		const resolved = compiler.resolveImport(p)
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
		/<([a-z0-9-]+)([^>]*?)\/>/gi,
		(match, tagName, attrs) => {
			const tag = String(tagName).toLowerCase()
			if (VOID_TAGS.has(tag)) {
				return match.replace(/\/>$/, '>')
			}
			return `<${tagName}${attrs}></${tagName}>`
		},
	)

	const { document } = parseHTML(
		`<!DOCTYPE html><html><body>${expandedTemplate}</body></html>`,
	)

	const scripts = document.querySelectorAll('script')
	for (const s of scripts) {
		if (
			!s.hasAttribute('type') &&
			!s.hasAttribute('on:client') &&
			!s.hasAttribute('on:build')
		) {
			s.setAttribute('type', 'module')
		}
	}

	let templateCode = ''
	if (document.body) {
		for (let i = 0; i < document.body.childNodes.length; i++) {
			templateCode += compiler.compileNode(document.body.childNodes[i])
		}
	}

	if (options.clientScriptUrl) {
		templateCode += `<script type="module" src="${options.clientScriptUrl}"></script>`
	}

	return `
		export default async function(tbd) {
			const { site, slots = {}, renderComponent } = tbd;
			${script}
			return \`${templateCode}\`;
		}
	`.trim()
}
