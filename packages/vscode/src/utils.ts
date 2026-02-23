/**
 * Shared utilities: kebab-case conversion, import extraction, and scope lookup.
 */
import { IMPORT_REGEX } from './constants'
import type { TemplateScope } from './analyzer'

/** Convert kebab-case to camelCase (e.g. `my-component` → `myComponent`). */
export function kebabToCamelCase(value: string): string {
	return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

/** Extract all imported names and their specifiers from script text (default, named, namespace). */
export function collectImportedSpecifiers(text: string): Map<string, string> {
	const imports = new Map<string, string>()
	IMPORT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = IMPORT_REGEX.exec(text)) !== null) {
		const defaultImport = match[2]?.trim()
		const namedImports = match[3]
		const namespaceImport = match[4]?.trim()
		const specifier = match[6]

		if (defaultImport) imports.set(defaultImport, specifier)
		if (namespaceImport) imports.set(namespaceImport, specifier)

		if (!namedImports) continue
		for (const rawName of namedImports.split(',')) {
			const name = rawName.trim()
			if (!name) continue
			const aliasParts = name.split(/\s+as\s+/i).map(part => part.trim())
			const localName = aliasParts[1] || aliasParts[0]
			if (localName) imports.set(localName, specifier)
		}
	}

	return imports
}

/** Return the smallest scope that contains the given offset (for nested scopes). */
export function findInnermostScope(scopes: TemplateScope[], offset: number): TemplateScope | null {
	let best: TemplateScope | null = null
	for (const scope of scopes) {
		if (offset < scope.startOffset || offset > scope.endOffset) continue
		if (!best) {
			best = scope
			continue
		}
		const bestSize = best.endOffset - best.startOffset
		const thisSize = scope.endOffset - scope.startOffset
		if (thisSize <= bestSize) {
			best = scope
		}
	}
	return best
}
