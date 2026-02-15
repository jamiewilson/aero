import * as vscode from 'vscode'
import { classifyPosition } from './positionAt'
import { getResolver } from './pathResolver'

/**
 * Provides Go to Definition for Aero template references in HTML files.
 *
 * Returns LocationLink[] (not Location) so that `originSelectionRange` controls
 * the underlined region in the source document -- e.g. the entire path string
 * acts as one clickable link rather than splitting on `/` and `.`.
 *
 * Supports:
 * - Import paths:        `import meta from '@components/meta'` -> src/components/meta.html
 * - Imported names:      `import meta from '...'` (name "meta") -> same file
 * - Script/link assets:  `src="@scripts/index.ts"` -> resolved asset
 * - Component tags:      `<nav-component>` -> src/components/nav.html
 * - Layout tags:         `<base-layout>` -> src/layouts/base.html
 * - Content globals:     `{ site.home.title }` -> src/content/site.ts (at property)
 */
export class AeroDefinitionProvider implements vscode.DefinitionProvider {
	provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.LocationLink[]> {
		const classification = classifyPosition(document, position)
		if (!classification) return null

		const resolver = getResolver(document)
		if (!resolver) return null

		switch (classification.kind) {
			case 'import-path': {
				const resolved = resolver.resolve(classification.specifier, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'import-name': {
				const resolved = resolver.resolve(classification.specifier, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'script-src':
			case 'link-href': {
				const value = classification.kind === 'script-src' ? classification.value : classification.value
				const resolved = resolver.resolve(value, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'component-tag': {
				const alias =
					classification.suffix === 'component'
						? `@components/${classification.baseName}`
						: `@layouts/${classification.baseName}`
				const resolved = resolver.resolve(alias, document.uri.fsPath)
				if (!resolved) return null
				return [makeLink(classification.range, resolved)]
			}

			case 'content-global': {
				const resolved = resolver.resolve(classification.alias, document.uri.fsPath)
				if (!resolved) return null
				const targetLine = classification.propertyPath
					? findPropertyLine(resolved, classification.propertyPath)
					: 0
				return [makeLink(classification.range, resolved, targetLine)]
			}

			case 'expression-identifier': {
				return null
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a LocationLink with originSelectionRange so VS Code underlines
 * exactly the range we specify (instead of splitting on word boundaries).
 */
function makeLink(
	originRange: vscode.Range,
	targetPath: string,
	targetLine: number = 0,
): vscode.LocationLink {
	const targetPos = new vscode.Position(targetLine, 0)
	return {
		originSelectionRange: originRange,
		targetUri: vscode.Uri.file(targetPath),
		targetRange: new vscode.Range(targetPos, targetPos),
		targetSelectionRange: new vscode.Range(targetPos, targetPos),
	}
}

/**
 * Find the line number of a nested property path in a TS/JS file.
 * For `site.home.title`, propertyPath is `['home', 'title']`.
 * Walks the file looking for each property key in sequence.
 */
function findPropertyLine(filePath: string, propertyPath: string[]): number {
	try {
		const fs = require('node:fs') as typeof import('node:fs')
		if (!fs.existsSync(filePath)) return 0
		const content = fs.readFileSync(filePath, 'utf-8')
		const lines = content.split('\n')

		let currentLine = 0
		for (const prop of propertyPath) {
			// Search forward from currentLine for a line containing this property key
			// Match patterns like: `key:`, `key :`, `'key':`, `"key":`
			const keyPattern = new RegExp(
				`(?:^|\\s|,)(?:${escapeRegex(prop)}|'${escapeRegex(prop)}'|"${escapeRegex(prop)}")\\s*:`,
			)
			let found = false
			for (let i = currentLine; i < lines.length; i++) {
				if (keyPattern.test(lines[i])) {
					currentLine = i
					found = true
					break
				}
			}
			if (!found) {
				// Property not found at this depth; return last known position
				break
			}
		}

		return currentLine
	} catch {
		return 0
	}
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
