import type { ParseResult } from './parser'
import { parseHTML } from 'linkedom'
import path from 'path'

export interface CompileOptions {
	appDir: string
	clientScriptUrl?: string
}

class Compiler {
	private appDir: string

	constructor(options: CompileOptions) {
		this.appDir = options.appDir
	}

	resolveAlias(p: string): string {
		if (p.startsWith('@/')) {
			const relativePath = p.slice(2)
			let resolved = path.join(this.appDir, relativePath)

			// Special case for templates: add .html if no extension
			if (!resolved.includes('.') && !resolved.includes('/assets/')) {
				resolved += '.html'
			}

			// Ensure we use root-relative paths for the browser/Vite resolver
			// This works better than absolute filesystem paths in the browser
			const rootRelative = '/' + path.relative(path.join(this.appDir, '..'), resolved)

			// For assets in the browser, Vite likes /@fs/ absolute paths for some reason
			// but root-relative /app/assets/... usually works too.
			if (rootRelative.includes('/assets/')) {
				return rootRelative
			}
			return rootRelative
		}
		return p
	}

	compileNode(node: any, skipInterpolation = false): string {
		switch (node.nodeType) {
			case 3: // Text node
				return this.compileText(node, skipInterpolation)
			case 1: // Element node
				return this.compileElement(node, skipInterpolation)
			default:
				return ''
		}
	}

	private compileText(node: any, skipInterpolation: boolean): string {
		let text = node.textContent || ''
		text = text.replace(/`/g, '\\`')
		if (!skipInterpolation) {
			// Simple interpolation: { val } -> ${val}
			text = text.replace(/{([\s\S]+?)}/g, '${$1}')
		}
		return text
	}

	private compileElement(node: any, skipInterpolation: boolean): string {
		const tagName = node.tagName.toLowerCase()

		// Handle Slots
		if (tagName === 'slot') {
			return this.compileSlot(node, skipInterpolation)
		}

		// Handle Components and Layouts
		if (tagName.endsWith('-component') || tagName.endsWith('-layout')) {
			return this.compileComponent(node, tagName, skipInterpolation)
		}

		// Handle regular HTML elements
		const attributes: string[] = []
		let loopData = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (attr.name === 'data-for') {
					const content = attr.value.replace(/^{|}$/g, '').trim()
					const match = content.match(/^(\w+)\s+in\s+(.+)$/)
					if (match) {
						loopData = { item: match[1], items: match[2] }
					}
					continue
				}

				let val = attr.value.replace(/`/g, '\\`')
				val = this.resolveAlias(val)

				// Skip TBD interpolation for Alpine.js attributes (x-, @, :, .)
				const isAlpine = /^(x-|[@:.]).*/.test(attr.name)
				if (!isAlpine) {
					val = val.replace(/{([\s\S]+?)}/g, '${$1}')
				}
				attributes.push(`${attr.name}="${val}"`)
			}
		}

		const attrString = attributes.length ? ' ' + attributes.join(' ') : ''

		// Recursively compile children
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

		// Collect props
		const propsEntries: string[] = []
		let dataPropsExpression: string | null = null

		if (node.attributes) {
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i]
				if (attr.name === 'data-for') continue

				if (attr.name === 'data-props') {
					const value = attr.value?.trim() || ''

					if (!value) {
						// Shorthand: data-props (no value) → spread 'props' variable
						// Like JavaScript object shorthand: { props } means { props: props }
						// Here: data-props means data-props="{ ...props }"
						dataPropsExpression = '...props'
					} else if (value.startsWith('{') && value.endsWith('}')) {
						// Has braces: could be inline object or spread
						const inner = value.slice(1, -1).trim()

						if (inner.startsWith('...')) {
							// Spread syntax: data-props="{ ...myProps }"
							dataPropsExpression = inner
						} else {
							// Inline object literal: data-props="{ title: 'Hello', count: 42 }"
							// or expression: data-props="{ title: site.meta.title.toUpperCase() }"
							dataPropsExpression = inner
						}
					} else {
						// Plain variable name: data-props="myProps" → spread it
						dataPropsExpression = `...${value}`
					}
					continue
				}

				// Regular prop attributes
				let val = attr.value.replace(/`/g, '\\`')
				if (val.startsWith('{') && val.endsWith('}')) {
					val = val.substring(1, val.length - 1)
				} else {
					val = `"${val}"`
				}
				propsEntries.push(`${attr.name}: ${val}`)
			}
		}

		// Build the props object
		let propsString: string
		if (dataPropsExpression) {
			// Has data-props
			if (propsEntries.length > 0) {
				// Merge: data-props + individual attributes
				propsString = `{ ${dataPropsExpression}, ${propsEntries.join(', ')} }`
			} else {
				// Just data-props
				propsString = `{ ${dataPropsExpression} }`
			}
		} else {
			// No data-props, just individual attributes
			propsString = `{ ${propsEntries.join(', ')} }`
		}

		// Collect slots
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

	// Transform static imports to dynamic imports
	const importRegex = /import\s+(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+(['"])(.+?)\4/g
	script = script.replace(importRegex, (m, name, names, starName, q, p) => {
		const resolved = compiler.resolveAlias(p)
		if (name) {
			return `const ${name} = (await import(${q}${resolved}${q})).default`
		} else if (names) {
			return `const {${names}} = await import(${q}${resolved}${q})`
		} else if (starName) {
			return `const ${starName} = await import(${q}${resolved}${q})`
		}
		return m
	})

	const expandedTemplate = parsed.template.replace(/<([a-z0-9-]+)([^>]*?)\/>/gi, '<$1$2></$1>')
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
