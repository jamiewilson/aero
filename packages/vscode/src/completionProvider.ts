import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { getResolver } from './pathResolver'
import { CONTENT_GLOBALS } from './constants'
import { isAeroDocument } from './scope'

// ---------------------------------------------------------------------------
// Aero-specific attribute completions
// ---------------------------------------------------------------------------

const AERO_ATTRIBUTES: Array<{
	label: string
	detail: string
	snippet?: string
	kind: vscode.CompletionItemKind
}> = [
	{
		label: 'is:build',
		detail: 'Build-time script block (Aero)',
		kind: vscode.CompletionItemKind.Property,
	},
	{
		label: 'is:bundled',
		detail: 'Client-side script block (Aero)',
		kind: vscode.CompletionItemKind.Property,
	},
	{
		label: 'is:inline',
		detail: 'Inline client script, no bundling (Aero)',
		kind: vscode.CompletionItemKind.Property,
	},
	{
		label: 'data-each',
		detail: 'Loop over items (Aero)',
		snippet: 'data-each="{ ${1:item} in ${2:items} }"',
		kind: vscode.CompletionItemKind.Keyword,
	},
	{
		label: 'data-if',
		detail: 'Conditional rendering (Aero)',
		snippet: 'data-if="{ ${1:condition} }"',
		kind: vscode.CompletionItemKind.Keyword,
	},
	{
		label: 'data-else-if',
		detail: 'Chained conditional (Aero)',
		snippet: 'data-else-if="{ ${1:condition} }"',
		kind: vscode.CompletionItemKind.Keyword,
	},
	{
		label: 'data-else',
		detail: 'Fallback conditional (Aero)',
		kind: vscode.CompletionItemKind.Keyword,
	},
	{
		label: 'data-props',
		detail: 'Spread props to component (Aero)',
		kind: vscode.CompletionItemKind.Property,
	},
	{
		label: 'each',
		detail: 'Loop over items (Aero shorthand)',
		snippet: 'each="{ ${1:item} in ${2:items} }"',
		kind: vscode.CompletionItemKind.Keyword,
	},
	{
		label: 'if',
		detail: 'Conditional rendering (Aero shorthand)',
		snippet: 'if="{ ${1:condition} }"',
		kind: vscode.CompletionItemKind.Keyword,
	},
	{
		label: 'else-if',
		detail: 'Chained conditional (Aero shorthand)',
		snippet: 'else-if="{ ${1:condition} }"',
		kind: vscode.CompletionItemKind.Keyword,
	},
	{
		label: 'else',
		detail: 'Fallback conditional (Aero shorthand)',
		kind: vscode.CompletionItemKind.Keyword,
	},
]

// ---------------------------------------------------------------------------
// Completion Provider
// ---------------------------------------------------------------------------

export class AeroCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		context: vscode.CompletionContext,
	): vscode.ProviderResult<vscode.CompletionItem[]> {
		if (!isAeroDocument(document)) return null

		const lineText = document.lineAt(position.line).text
		const textBefore = lineText.slice(0, position.character)

		// 1. Component/layout tag completions after `<`
		const tagMatch = textBefore.match(/<([a-z][a-z0-9-]*)$/)
		if (tagMatch) {
			return this.getComponentTagCompletions(document, tagMatch[1])
		}

		// 2. Aero attribute completions inside a tag
		if (this.isInsideTag(lineText, position.character)) {
			return this.getAttributeCompletions(textBefore)
		}

		// 3. Import path / alias completions
		const importMatch = textBefore.match(/from\s+['"]([^'"]*?)$/)
		if (importMatch) {
			return this.getImportPathCompletions(document, importMatch[1])
		}

		// 4. Content global completions inside { }
		if (this.isInsideExpression(textBefore)) {
			return this.getExpressionCompletions()
		}

		return null
	}

	// -----------------------------------------------------------------------
	// Component tag completions
	// -----------------------------------------------------------------------

	private getComponentTagCompletions(
		document: vscode.TextDocument,
		prefix: string,
	): vscode.CompletionItem[] {
		const resolver = getResolver(document)
		if (!resolver) return []

		const items: vscode.CompletionItem[] = []

		// Scan client/components/ for component files
		const componentsDir = path.join(resolver.root, 'client', 'components')
		items.push(...this.scanDirForTags(componentsDir, 'component', prefix))

		// Scan client/layouts/ for layout files
		const layoutsDir = path.join(resolver.root, 'client', 'layouts')
		items.push(...this.scanDirForTags(layoutsDir, 'layout', prefix))

		return items
	}

	private scanDirForTags(
		dir: string,
		suffix: 'component' | 'layout',
		prefix: string,
	): vscode.CompletionItem[] {
		const items: vscode.CompletionItem[] = []

		if (!fs.existsSync(dir)) return items

		try {
			const files = fs.readdirSync(dir)
			for (const file of files) {
				if (!file.endsWith('.html')) continue
				const baseName = file.replace(/\.html$/, '')
				// Convert camelCase to kebab-case for tag name
				const kebab = baseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
				const tagName = `${kebab}-${suffix}`

				if (!tagName.startsWith(prefix)) continue

				const item = new vscode.CompletionItem(
					tagName,
					suffix === 'component'
						? vscode.CompletionItemKind.Class
						: vscode.CompletionItemKind.Struct,
				)
				item.detail = `${suffix === 'component' ? 'Component' : 'Layout'}: ${file}`
				item.insertText = new vscode.SnippetString(`${tagName} $1/>\n`)
				items.push(item)
			}
		} catch {
			// Directory read error
		}

		return items
	}

	// -----------------------------------------------------------------------
	// Attribute completions
	// -----------------------------------------------------------------------

	private getAttributeCompletions(textBefore: string): vscode.CompletionItem[] {
		// Only suggest if we're at an attribute position (after whitespace following tag name or other attr)
		if (!/\s$/.test(textBefore) && !/=["'][^"']*$/.test(textBefore)) {
			// Check if we're mid-word at an attribute position
			const attrPrefix = textBefore.match(/\s([a-z-:]*)$/)?.[1]
			if (attrPrefix === undefined) return []
		}

		return AERO_ATTRIBUTES.map(attr => {
			const item = new vscode.CompletionItem(attr.label, attr.kind)
			item.detail = attr.detail
			if (attr.snippet) {
				item.insertText = new vscode.SnippetString(attr.snippet)
			}
			return item
		})
	}

	// -----------------------------------------------------------------------
	// Import path completions
	// -----------------------------------------------------------------------

	private getImportPathCompletions(
		document: vscode.TextDocument,
		partial: string,
	): vscode.CompletionItem[] {
		const resolver = getResolver(document)
		if (!resolver) return []

		const items: vscode.CompletionItem[] = []

		// Suggest alias prefixes if nothing typed yet or starts with @
		if (!partial || partial === '@') {
			const aliases = [
				'@components/',
				'@layouts/',
				'@content/',
				'@pages/',
				'@styles/',
				'@scripts/',
				'@images/',
				'@client/',
				'@server/',
				'~/',
			]
			for (const alias of aliases) {
				if (alias.startsWith(partial)) {
					const item = new vscode.CompletionItem(alias, vscode.CompletionItemKind.Folder)
					item.detail = 'Aero path alias'
					items.push(item)
				}
			}
			return items
		}

		// If partial starts with an alias, list files in that directory
		const resolved = resolver.resolve(partial)
		if (resolved) {
			const dir =
				fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
					? resolved
					: path.dirname(resolved)

			if (fs.existsSync(dir)) {
				try {
					const files = fs.readdirSync(dir)
					for (const file of files) {
						const filePath = path.join(dir, file)
						const stat = fs.statSync(filePath)
						if (stat.isDirectory()) {
							const item = new vscode.CompletionItem(
								file + '/',
								vscode.CompletionItemKind.Folder,
							)
							items.push(item)
						} else {
							const baseName = file.replace(/\.(html|ts|js|json)$/, '')
							const item = new vscode.CompletionItem(baseName, vscode.CompletionItemKind.File)
							item.detail = file
							items.push(item)
						}
					}
				} catch {
					// Directory read error
				}
			}
		}

		return items
	}

	// -----------------------------------------------------------------------
	// Expression completions
	// -----------------------------------------------------------------------

	private getExpressionCompletions(): vscode.CompletionItem[] {
		const items: vscode.CompletionItem[] = []

		// Content globals
		for (const [name, alias] of Object.entries(CONTENT_GLOBALS)) {
			const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable)
			item.detail = `Content global (${alias})`
			items.push(item)
		}

		// Aero.props
		const propsItem = new vscode.CompletionItem('Aero', vscode.CompletionItemKind.Module)
		propsItem.detail = 'Aero runtime context'
		items.push(propsItem)

		return items
	}

	// -----------------------------------------------------------------------
	// Context detection helpers
	// -----------------------------------------------------------------------

	private isInsideTag(lineText: string, offset: number): boolean {
		// Simple heuristic: find the last `<` before offset that isn't closed by `>`
		let lastOpen = -1
		let lastClose = -1
		for (let i = 0; i < offset; i++) {
			if (lineText[i] === '<' && lineText[i + 1] !== '/') lastOpen = i
			if (lineText[i] === '>') lastClose = i
		}
		return lastOpen > lastClose
	}

	private isInsideExpression(textBefore: string): boolean {
		let depth = 0
		for (let i = textBefore.length - 1; i >= 0; i--) {
			if (textBefore[i] === '}') depth++
			if (textBefore[i] === '{') {
				if (depth === 0) return true
				depth--
			}
		}
		return false
	}
}
