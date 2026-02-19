import * as vscode from 'vscode'
import { IMPORT_REGEX, CURLY_INTERPOLATION_REGEX, CONTENT_GLOBALS } from './constants'

export type VariableDefinition = {
	name: string
	range: vscode.Range
	kind: 'import' | 'declaration' | 'parameter'
	contentRef?: { alias: string; propertyPath: string[] }
	properties?: Set<string>
}

export type TemplateScope = {
	itemName: string
	itemRange: vscode.Range
	sourceExpr: string
	sourceRoot: string
	sourceRange: vscode.Range
	startOffset: number
	endOffset: number
}

export type TemplateReference = {
	content: string
	range: vscode.Range
	offset: number
	isAttribute: boolean
	propertyPath?: string[]
	propertyRanges?: vscode.Range[]
	isComponent?: boolean
	isAlpine?: boolean
}

/**
 * Replaces JS comments with spaces to preserve indices.
 */
export function maskJsComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, match => ' '.repeat(match.length))
}

/**
 * Collects all defined variables in <script> blocks (imports, declarations).
 * Returns tuple: [variables map, duplicates array]
 */
export function collectDefinedVariables(
	document: vscode.TextDocument,
	text: string,
): [Map<string, VariableDefinition>, Array<{ name: string; kind1: string; kind2: string; range: vscode.Range }>] {
	const vars = new Map<string, VariableDefinition>()
	const duplicates: Array<{ name: string; kind1: string; kind2: string; range: vscode.Range }> = []

	const setVar = (name: string, def: VariableDefinition) => {
		const existing = vars.get(name)
		if (existing) {
			duplicates.push({
				name,
				kind1: existing.kind,
				kind2: def.kind,
				range: def.range,
			})
		}
		vars.set(name, def)
	}

	// 1. Imports
	// Imports are usually at the top, but we should strip comments just in case?
	// Actually regex for imports might be fragile with comments if we don't.
	// But standard `import` regex is usually robust enough if anchored.
	// For now, let's keep imports as is, or mask text globally first?
	// Masking globally is safer but might be expensive.
	// Let's stick to masking where we extract identifiers.

	IMPORT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = IMPORT_REGEX.exec(text)) !== null) {
		const defaultImport = match[2]?.trim() // Group 2, not 1
		const namedImports = match[3] // Group 3, not 2
		const namespaceImport = match[4]?.trim() // Group 4, not 3
		const specifier = match[6] // Group 6 is correct
		const start = match.index

		if (defaultImport) {
			const nameStart = start + match[0].indexOf(defaultImport)
			setVar(defaultImport, {
				name: defaultImport,
				range: new vscode.Range(
					document.positionAt(nameStart),
					document.positionAt(nameStart + defaultImport.length),
				),
				kind: 'import',
			})
		}

		if (namespaceImport) {
			const nameStart = start + match[0].indexOf(namespaceImport)
			setVar(namespaceImport, {
				name: namespaceImport,
				range: new vscode.Range(
					document.positionAt(nameStart),
					document.positionAt(nameStart + namespaceImport.length),
				),
				kind: 'import',
			})
		}

		if (namedImports) {
			const namedPartStart = start + match[0].indexOf(namedImports)
			// Simple parsing for named imports: `foo, bar as baz`
			const parts = namedImports.split(',')
			let currentOffset = 0

			for (const part of parts) {
				const trimmed = part.trim()
				if (!trimmed) {
					currentOffset += part.length + 1 // +1 for comma
					continue
				}

				const asIndex = trimmed.indexOf(' as ')
				let localName = trimmed
				if (asIndex > -1) {
					localName = trimmed.slice(asIndex + 4).trim()
				}

				const relativeStart = part.indexOf(localName)
				const absStart =
					namedPartStart +
					currentOffset +
					part.indexOf(trimmed) +
					(asIndex > -1 ? asIndex + 4 : 0) +
					(localName === trimmed
						? 0
						: trimmed.indexOf(localName) - (asIndex > -1 ? asIndex + 4 : 0)) // Approximation, let's do better

				// Re-calculating position more reliably
				const partIndexInNamed = namedImports.indexOf(part, currentOffset) // Find specific occurrence
				const localNameIndexInPart = part.lastIndexOf(localName)
				const finalStart = namedPartStart + partIndexInNamed + localNameIndexInPart

				if (localName) {
					setVar(localName, {
						name: localName,
						range: new vscode.Range(
							document.positionAt(finalStart),
							document.positionAt(finalStart + localName.length),
						),
						kind: 'import',
					})
				}

				currentOffset = partIndexInNamed + part.length
			}
		}
	}

	// 2. Script declarations — only on:build scripts are visible to the template
	const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
	let scriptMatch: RegExpExecArray | null
	while ((scriptMatch = scriptRegex.exec(text)) !== null) {
		const attrs = (scriptMatch[1] || '').toLowerCase()
		if (/\bsrc\s*=/.test(attrs)) continue
		// Skip on:client blocks — they are browser-only and isolated from the template
		if (/\bon:client\b/.test(attrs)) continue

		const content = scriptMatch[2]
		const contentStart = scriptMatch.index + scriptMatch[0].indexOf(content)
		const maskedContent = maskJsComments(content)

		// Regex for top-level const/let/var
		// Supports: const x = 1, { y } = obj, [z] = arr
		// Limitations: Regex is not a parser. Complex destructuring might be missed.
		// For now, sticking to the existing robust regex for simple identifiers + destructuring support

		// Simple identifier: const x = ...
		const simpleDeclRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(\{[\s\S]*?\})?/g
		let declMatch: RegExpExecArray | null
		while ((declMatch = simpleDeclRegex.exec(maskedContent)) !== null) {
			const name = declMatch[1]
			const initializer = declMatch[2]
			const start = contentStart + declMatch.index + declMatch[0].indexOf(name)

			const def: VariableDefinition = {
				name,
				range: new vscode.Range(
					document.positionAt(start),
					document.positionAt(start + name.length),
				),
				kind: 'declaration',
			}

			if (initializer) {
				// Try to parse keys from object literal
				// We assume it's a simple object literal: { key: val, key2: val2 }
				// We rely on maskedContent having comments stripped.
				const properties = new Set<string>()
				// Regex to find keys: identifier followed by :
				const keyRegex = /([A-Za-z_$][\w$]*)\s*:/g
				let keyMatch: RegExpExecArray | null
				while ((keyMatch = keyRegex.exec(initializer)) !== null) {
					properties.add(keyMatch[1])
				}
				// Also shorthand: { prop } (identifier followed by , or })
				// This is harder to distinguish from value usage without full parsing.
				// But we can try: , prop , or { prop ,
				const shorthandRegex = /(?:\{|,)\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g
				while ((keyMatch = shorthandRegex.exec(initializer)) !== null) {
					properties.add(keyMatch[1])
				}

				if (properties.size > 0) {
					def.properties = properties
				}
			}

			setVar(name, def)
		}

		// Destructuring: const { x, y: z } = ...
		const destructuringRegex = /\b(?:const|let|var)\s+\{([^}]+)\}\s*=/g
		while ((declMatch = destructuringRegex.exec(maskedContent)) !== null) {
			const body = declMatch[1]
			const bodyStart = contentStart + declMatch.index + declMatch[0].indexOf(body)

			// Split by comma, handle aliases
			const parts = body.split(',')
			let currentOffset = 0
			for (const part of parts) {
				const trimmed = part.trim()
				if (!trimmed) {
					currentOffset += part.length + 1
					continue
				}

				const colonIndex = trimmed.indexOf(':')
				let localName = trimmed
				if (colonIndex > -1) {
					localName = trimmed.slice(colonIndex + 1).trim()
				}

				// Find position
				const partIndex = body.indexOf(part, currentOffset)
				const localIndex = part.lastIndexOf(localName)
				const absStart = bodyStart + partIndex + localIndex

				if (localName) {
					setVar(localName, {
						name: localName,
						range: new vscode.Range(
							document.positionAt(absStart),
							document.positionAt(absStart + localName.length),
						),
						kind: 'declaration',
					})
				}
				currentOffset = partIndex + part.length
			}
		}
	}

	return [vars, duplicates]
}

/**
 * Collects scopes created by `data-each` attributes.
 */
export function collectTemplateScopes(
	document: vscode.TextDocument,
	text: string,
): TemplateScope[] {
	type StackItem = {
		tagName: string
		each?: Omit<TemplateScope, 'endOffset'>
	}

	const scopes: TemplateScope[] = []
	const stack: StackItem[] = []
	const tagRegex = /<\/?([a-z][a-z0-9-]*)\b([^>]*?)>/gi

	let match: RegExpExecArray | null
	while ((match = tagRegex.exec(text)) !== null) {
		const fullTag = match[0]
		const isClosing = fullTag.startsWith('</')
		const tagName = match[1]
		const attrs = match[2] || ''
		const tagStart = match.index
		const tagEnd = tagStart + fullTag.length

		if (isClosing) {
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i].tagName === tagName) {
					const open = stack.splice(i, 1)[0]
					if (open.each) {
						scopes.push({ ...open.each, endOffset: tagEnd })
					}
					break
				}
			}
			continue
		}

		const each = parseEachAttribute(document, attrs, tagStart, fullTag)
		const selfClosing = /\/\s*>$/.test(fullTag)
		if (selfClosing) {
			if (each) {
				scopes.push({ ...each, startOffset: tagStart, endOffset: tagEnd })
			}
			continue
		}

		stack.push({
			tagName,
			each: each ? { ...each, startOffset: tagStart } : undefined,
		})
	}

	// Close remaining open scopes (e.g. malformed HTML)
	for (const open of stack) {
		if (open.each) {
			scopes.push({ ...open.each, endOffset: text.length })
		}
	}

	return scopes
}

function parseEachAttribute(
	document: vscode.TextDocument,
	attrs: string,
	tagStart: number,
	fullTag: string,
): Omit<TemplateScope, 'startOffset' | 'endOffset'> | null {
	const eachAttr = /\b(?:data-)?each\s*=\s*(['"])(.*?)\1/i.exec(attrs)
	if (!eachAttr) return null

	const rawValue = eachAttr[2] || ''
	let exprContent = rawValue
	let exprContentOffset = 0

	// Handle wrapping { }
	// Common in Aero: each="{ item in items }"
	const curlyMatch = /^\s*\{([\s\S]*)\}\s*$/.exec(rawValue)
	if (curlyMatch) {
		exprContent = curlyMatch[1]
		// Calculate offset of the content inside { }
		// rawValue.indexOf(exprContent) is risky if exprContent repeats, but standard { content } is simple.
		// A safer way is using the match index from a more precise regex or just indexOf if we assume unique structure
		exprContentOffset = rawValue.indexOf(exprContent)
	}

	const expr = exprContent.trim()
	const exprMatch =
		/^([A-Za-z_$][\w$]*)\s+in\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/.exec(expr)
	if (!exprMatch) return null

	const itemName = exprMatch[1]
	const sourceExpr = exprMatch[2]
	const sourceRoot = sourceExpr.split('.')[0]

	const attrsOffsetInTag = fullTag.indexOf(attrs)
	const attrBase = tagStart + (attrsOffsetInTag >= 0 ? attrsOffsetInTag : 0)
	const valueOffsetInAttr = eachAttr[0].indexOf(rawValue)
	// Base offset for rawValue
	const valueStart = attrBase + eachAttr.index + valueOffsetInAttr

	// Offset for expr inside rawValue (account for { and whitespace)
	const exprStartInValue = exprContentOffset + exprContent.indexOf(expr)
	const exprStart = valueStart + exprStartInValue

	const itemStart = exprStart + expr.indexOf(itemName)
	const itemEnd = itemStart + itemName.length
	const sourceStart = exprStart + expr.lastIndexOf(sourceExpr)
	const sourceEnd = sourceStart + sourceExpr.length

	return {
		itemName,
		itemRange: new vscode.Range(document.positionAt(itemStart), document.positionAt(itemEnd)),
		sourceExpr,
		sourceRoot,
		sourceRange: new vscode.Range(
			document.positionAt(sourceStart),
			document.positionAt(sourceEnd),
		),
	}
}

/**
 * Collects all variable references in the template (attributes and content).
 */
export function collectTemplateReferences(
	document: vscode.TextDocument,
	text: string,
): TemplateReference[] {
	const refs: TemplateReference[] = []

	// 0. Mask <script> and <style> blocks content to avoid false positives in CSS or JS
	// We replace content with spaces to preserve indices
	let maskedText = text.replace(
		/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi,
		(match, tag, content) => {
			return match.replace(content, ' '.repeat(content.length))
		},
	)

	// 1. Mask HTML comments
	maskedText = maskedText.replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))

	// 2. Scan tags and attributes
	// We scan for tags in the masked text to locate attributes reliably
	const tagRegex = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)>/gi
	let tagMatch: RegExpExecArray | null

	while ((tagMatch = tagRegex.exec(maskedText)) !== null) {
		const tagName = tagMatch[1]
		if (tagName === 'script' || tagName === 'style') continue

		// Check for component/layout usage
		// e.g. <meta-component> -> uses `meta`
		if (tagName.endsWith('-component') || tagName.endsWith('-layout')) {
			const suffix = tagName.endsWith('-component') ? '-component' : '-layout'
			const prefix = tagName.slice(0, -suffix.length) // 'meta' from 'meta-component'

			// Camelize to match typical JS variable naming (my-var -> myVar)
			const camelPrefix = prefix.replace(/-([a-z])/g, g => g[1].toUpperCase())

			// Use the prefix range
			refs.push({
				content: camelPrefix,
				range: new vscode.Range(
					document.positionAt(tagMatch.index + 1),
					document.positionAt(tagMatch.index + 1 + prefix.length),
				),
				offset: tagMatch.index + 1,
				isAttribute: false,
				isComponent: true,
			})
		}

		const attrsContent = tagMatch[2]
		const tagStart = tagMatch.index
		const attrsStart = tagStart + tagMatch[0].indexOf(attrsContent)

		// Helper to mask value in global text
		const maskRange = (start: number, length: number) => {
			maskedText =
				maskedText.substring(0, start) +
				' '.repeat(length) +
				maskedText.substring(start + length)
		}

		// Regex for attributes: name="value" or name
		// Supports: foo="bar", foo='bar', foo (standalone), @foo="bar", :foo="bar"
		const attrRegex = /(?:\s|^)([a-zA-Z0-9-:@.]+)(?:(\s*=\s*)(['"])([\s\S]*?)\3)?/gi
		let attrMatch: RegExpExecArray | null

		while ((attrMatch = attrRegex.exec(attrsContent)) !== null) {
			const fullMatch = attrMatch[0]
			const name = attrMatch[1]
			const hasValue = !!attrMatch[3]
			const value = attrMatch[4] || ''

			// Calculate offsets
			const matchStartInAttrs = attrMatch.index
			const nameStartInMatch = fullMatch.indexOf(name) // Handle leading space
			const absNameStart = attrsStart + matchStartInAttrs + nameStartInMatch

			// Check for Alpine/Special attributes
			const isAlpine = name.startsWith(':') || name.startsWith('@') || name.startsWith('x-')

			if (hasValue) {
				// Value exists
				const quote = attrMatch[3]
				// structure: [space]name [=] [quote] value [quote]
				const quoteIndex = fullMatch.indexOf(quote, nameStartInMatch + name.length)
				const absValueStart = attrsStart + matchStartInAttrs + quoteIndex + 1

				if (isAlpine) {
					// Extract references from Alpine/HTMX attributes (x-data, @htmx:*, etc.)
					// These can contain object literals or event handlers with variable references
					extractIdentifiers(value, absValueStart, document, refs, true, true)
					// MASK value so global scan skips it
					maskRange(absValueStart, value.length)
				} else {
					// Standard attribute, check for interpolations { ... }
					// Scan for curlies inside this attribute value.
					const valueIterRegex = /{([\s\S]+?)}/g
					let localCurlyMatch: RegExpExecArray | null
					while ((localCurlyMatch = valueIterRegex.exec(value)) !== null) {
						const content = localCurlyMatch[1]
						const contentStart = absValueStart + localCurlyMatch.index + 1 // +1 for {
						extractIdentifiers(content, contentStart, document, refs, true)
					}
					// MASK value so global scan skips it
					maskRange(absValueStart, value.length)
				}
			} else {
				// Standalone attribute
				// e.g. <comp props /> or <input disabled />
				// If it's a valid identifier, treat as reference (shorthand)
				// Also ignore Alpine shorthands if they exist and are not caught by isAlpine (unlikely for pure identifiers)
				if (/^[a-zA-Z_$][\w$]*$/.test(name)) {
					refs.push({
						content: name,
						range: new vscode.Range(
							document.positionAt(absNameStart),
							document.positionAt(absNameStart + name.length),
						),
						offset: absNameStart,
						isAttribute: true,
					})
				}
			}
		}
	}

	// 1. Content interpolations: { foo } (Global scan on remaining text)
	// Now maskedText has Scripts, Styles, AND Attribute Values masked out.
	CURLY_INTERPOLATION_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = CURLY_INTERPOLATION_REGEX.exec(maskedText)) !== null) {
		const content = match[1]
		const contentStart = match.index + match[0].indexOf(content)
		extractIdentifiers(content, contentStart, document, refs, false)
	}

	return refs
}

function extractIdentifiers(
	content: string,
	startOffset: number,
	document: vscode.TextDocument,
	refs: TemplateReference[],
	isAttribute: boolean,
	isAlpine?: boolean,
) {
	// Mask string literals to avoid matching inside them
	// We replace content with spaces to preserve indices
	const maskedContent = content.replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, match =>
		' '.repeat(match.length),
	)

	// Simple tokenizer for identifiers
	const idRegex = /\b([a-zA-Z_$][\w$]*)\b/g
	let match: RegExpExecArray | null
	while ((match = idRegex.exec(maskedContent)) !== null) {
		const id = match[1]
		// Skip keywords
		if (
			/^(if|else|return|function|var|let|const|import|from|as|in|true|false|null|undefined)$/.test(
				id,
			)
		)
			continue

		// Skip property access (foo.bar -> bar is prop)
		// Check character before
		const indexInContent = match.index
		const charBefore = indexInContent > 0 ? content[indexInContent - 1] : ''
		if (charBefore === '.') {
			// Check for spread operator (...)
			const isSpread =
				indexInContent >= 3 && content.slice(indexInContent - 3, indexInContent) === '...'
			if (!isSpread) continue
		}

		// Check for object key (foo: bar -> foo is key)
		// Heuristic: check if followed by optional whitespace and then a colon
		const afterId = content.slice(indexInContent + id.length)
		if (/^\s*:\s*/.test(afterId)) {
			// It's likely a key in an object literal or type annotation
			continue
		}

		// Check for property access (foo.bar)
		// We use maskedContent to avoid matching inside strings
		const propertyPath: string[] = []
		const propertyRanges: vscode.Range[] = []

		let currentAfter = maskedContent.slice(indexInContent + id.length)
		let currentOffsetRel = indexInContent + id.length

		const propRegex = /^\s*\.\s*([a-zA-Z_$][\w$]*)/
		let propMatch
		while ((propMatch = propRegex.exec(currentAfter))) {
			const propName = propMatch[1]
			propertyPath.push(propName)

			// Calculate range for this property
			// propMatch[0] is e.g. " . bar"
			// propName is "bar"
			const matchStartInAfter = propMatch.index
			const nameStartInMatch = propMatch[0].lastIndexOf(propName)
			const propAbsStart =
				startOffset + currentOffsetRel + matchStartInAfter + nameStartInMatch

			propertyRanges.push(
				new vscode.Range(
					document.positionAt(propAbsStart),
					document.positionAt(propAbsStart + propName.length),
				),
			)

			const matchLen = propMatch[0].length
			currentAfter = currentAfter.slice(matchLen)
			currentOffsetRel += matchLen
		}

		const absStart = startOffset + match.index
		const ref: TemplateReference = {
			content: id,
			range: new vscode.Range(
				document.positionAt(absStart),
				document.positionAt(absStart + id.length),
			),
			offset: absStart,
			isAttribute,
			isAlpine,
		}

		if (propertyPath.length > 0) {
			ref.propertyPath = propertyPath
			ref.propertyRanges = propertyRanges
		}

		refs.push(ref)
	}
}
