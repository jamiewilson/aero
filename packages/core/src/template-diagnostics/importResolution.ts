import * as fs from 'node:fs'
import * as path from 'node:path'

/** Aero template import aliases — imports must include an explicit `.html` extension. */
export const TEMPLATE_IMPORT_PREFIXES = ['@components/', '@layouts/', '@pages/'] as const

const INDEX_CANDIDATES = ['index.ts', 'index.tsx', 'index.js', 'index.mjs'] as const
const MODULE_EXTENSION_CANDIDATES = ['.ts', '.tsx', '.js', '.mjs', '.css', '.md', '.mdx'] as const

export function isExistingFile(filePath: string): boolean {
	try {
		return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
	} catch {
		return false
	}
}

/** True when the specifier targets the template alias namespace (@components, @layouts, @pages). */
export function isTemplateAliasSpecifier(specifier: string): boolean {
	return TEMPLATE_IMPORT_PREFIXES.some(
		prefix => specifier === prefix.slice(0, -1) || specifier.startsWith(prefix)
	)
}

/**
 * True when a build-script import can bind a component/layout tag.
 * Template alias imports must end in `.html`; relative imports must be explicit `*.html` paths.
 */
export function isValidTemplateImportSpecifier(specifier: string): boolean {
	if (isTemplateAliasSpecifier(specifier)) return specifier.endsWith('.html')
	if (specifier.startsWith('./') || specifier.startsWith('../')) return specifier.endsWith('.html')
	return false
}

function resolveModuleCandidate(candidate: string): string | undefined {
	if (!candidate) return undefined
	if (isExistingFile(candidate)) return candidate

	if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
		for (const indexName of INDEX_CANDIDATES) {
			const indexPath = path.join(candidate, indexName)
			if (isExistingFile(indexPath)) return indexPath
		}
		return undefined
	}

	if (!path.extname(candidate)) {
		for (const ext of MODULE_EXTENSION_CANDIDATES) {
			const withExt = candidate + ext
			if (isExistingFile(withExt)) return withExt
		}
	}

	return undefined
}

/**
 * Resolve an alias-joined path to an on-disk file using Aero import rules.
 * Template imports never infer `.html`; module imports may infer TS/CSS extensions and index files.
 */
export function resolveImportToFile(specifier: string, rawResolved: string): string | undefined {
	if (!rawResolved) return undefined

	if (isTemplateAliasSpecifier(specifier) || specifier.endsWith('.html')) {
		if (isTemplateAliasSpecifier(specifier) && !specifier.endsWith('.html')) return undefined
		return isExistingFile(rawResolved) ? rawResolved : undefined
	}

	return resolveModuleCandidate(rawResolved)
}
