import * as vscode from 'vscode'
import * as fs from 'node:fs'
import { classifyPosition } from './positionAt'
import { getResolver } from './pathResolver'
import { isAeroDocument } from './scope'

/**
 * Provides hover information for Aero template references in HTML files.
 *
 * Supports:
 * - Component/layout tags: shows file path and first few lines
 * - Import paths: shows resolved file path
 * - Content globals: shows resolved file path and preview
 */
export class AeroHoverProvider implements vscode.HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.Hover> {
		if (!isAeroDocument(document)) return null

		const classification = classifyPosition(document, position)
		if (!classification) return null

		const resolver = getResolver(document)
		if (!resolver) return null

		switch (classification.kind) {
			case 'import-path': {
				const resolved = resolver.resolve(classification.specifier, document.uri.fsPath)
				if (!resolved) return null
				return new vscode.Hover(
					new vscode.MarkdownString(
						`**Import**: \`${classification.specifier}\`\n\nResolved to: \`${resolved}\``,
					),
					classification.range,
				)
			}

			case 'import-name': {
				const resolved = resolver.resolve(classification.specifier, document.uri.fsPath)
				if (!resolved) return null
				return new vscode.Hover(
					new vscode.MarkdownString(
						`**${classification.name}** imported from \`${classification.specifier}\`\n\nResolved to: \`${resolved}\``,
					),
					classification.range,
				)
			}

			case 'script-src':
			case 'link-href': {
				const value =
					classification.kind === 'script-src' ? classification.value : classification.value
				const resolved = resolver.resolve(value, document.uri.fsPath)
				if (!resolved) return null
				const label = classification.kind === 'script-src' ? 'Script source' : 'Link href'
				return new vscode.Hover(
					new vscode.MarkdownString(
						`**${label}**: \`${value}\`\n\nResolved to: \`${resolved}\``,
					),
					classification.range,
				)
			}

			case 'component-tag': {
				const alias =
					classification.suffix === 'component'
						? `@components/${classification.baseName}`
						: `@layouts/${classification.baseName}`
				const resolved = resolver.resolve(alias, document.uri.fsPath)
				if (!resolved) return null

				const typeLabel = classification.suffix === 'component' ? 'Component' : 'Layout'
				const md = new vscode.MarkdownString()
				md.appendMarkdown(`**${typeLabel}**: \`${classification.tagName}\`\n\n`)
				md.appendMarkdown(`File: \`${resolved}\`\n\n`)

				// Show a preview of the file content
				const preview = getFilePreview(resolved, 8)
				if (preview) {
					md.appendCodeblock(preview, 'html')
				}

				return new vscode.Hover(md, classification.range)
			}

			case 'content-global': {
				const resolved = resolver.resolve(classification.alias, document.uri.fsPath)
				if (!resolved) return null

				const md = new vscode.MarkdownString()
				const fullPath =
					classification.propertyPath.length > 0
						? `${classification.identifier}.${classification.propertyPath.join('.')}`
						: classification.identifier
				md.appendMarkdown(`**Content global**: \`${fullPath}\`\n\n`)
				md.appendMarkdown(`Source: \`${resolved}\`\n\n`)

				const preview = getFilePreview(resolved, 12)
				if (preview) {
					const ext = resolved.endsWith('.ts') ? 'typescript' : 'javascript'
					md.appendCodeblock(preview, ext)
				}

				return new vscode.Hover(md, classification.range)
			}

			case 'expression-identifier':
				return null
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the first N lines of a file for hover preview.
 */
function getFilePreview(filePath: string, maxLines: number): string | null {
	try {
		if (!fs.existsSync(filePath)) return null
		const content = fs.readFileSync(filePath, 'utf-8')
		const lines = content.split('\n')
		const preview = lines.slice(0, maxLines)
		if (lines.length > maxLines) {
			preview.push('// ...')
		}
		return preview.join('\n')
	} catch {
		return null
	}
}
