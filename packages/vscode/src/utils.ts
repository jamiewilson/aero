/**
 * Shared utilities: kebab-case conversion, import extraction, and scope lookup.
 */
import { analyzeBuildScriptForEditor } from '@aerobuilt/core/editor'
import type { TemplateScope } from './analyzer'

/** Convert kebab-case to camelCase (e.g. `my-component` → `myComponent`). */
export function kebabToCamelCase(value: string): string {
	return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

const BUILD_SCRIPT_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

/**
 * Extract all imported names and their specifiers from an HTML document by
 * parsing each <script is:build> block and merging results. Use this when
 * you have the full document text (e.g. diagnostics, definition provider).
 */
export function collectImportedSpecifiersFromDocument(documentText: string): Map<string, string> {
	const merged = new Map<string, string>()
	BUILD_SCRIPT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = BUILD_SCRIPT_REGEX.exec(documentText)) !== null) {
		const attrs = (match[1] || '').toLowerCase()
		if (/\bsrc\s*=/.test(attrs)) continue
		if (!/\bis:build\b/.test(attrs)) continue
		const content = match[2]
		const blockImports = collectImportedSpecifiers(content)
		for (const [name, specifier] of blockImports) {
			merged.set(name, specifier)
		}
	}
	return merged
}

/** Extract all imported names and their specifiers from script text (default, named, namespace). Expects script content only, not full HTML. */
export function collectImportedSpecifiers(text: string): Map<string, string> {
	const imports = new Map<string, string>()
	try {
		const { imports: editorImports } = analyzeBuildScriptForEditor(text)
		for (const imp of editorImports) {
			const specifier = imp.specifier
			if (imp.defaultBinding) imports.set(imp.defaultBinding, specifier)
			if (imp.namespaceBinding) imports.set(imp.namespaceBinding, specifier)
			for (const { local } of imp.namedBindings) {
				imports.set(local, specifier)
			}
		}
	} catch {
		// Parse error; return empty map
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
