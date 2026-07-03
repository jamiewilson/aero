import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
/**
 * Diagnostic check: missing component/layout files.
 */
import { COMPONENT_SUFFIX_REGEX } from '../constants'
import type { PathResolver } from '../path-resolver'
import { kebabToCamelCase, collectImportedSpecifiersFromDocument } from '../utils'
import { isValidTemplateImportSpecifier } from '../importResolution'
import { getIgnoredRanges, isInRanges, findTagNameRange } from './helpers'

/** Matches opening tags with component/layout suffix */
const COMPONENT_TAG_OPEN_REGEX =
	/<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\/?>/gi

export function checkComponentReferences(
	document: SourceDocument,
	text: string,
	diagnostics: AeroDiagnostic[],
	resolver: PathResolver
): void {
	const imports = collectImportedSpecifiersFromDocument(text)
	const ignoredRanges = getIgnoredRanges(text)

	COMPONENT_TAG_OPEN_REGEX.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = COMPONENT_TAG_OPEN_REGEX.exec(text)) !== null) {
		const tagStart = match.index
		if (isInRanges(tagStart, ignoredRanges)) continue

		const tagName = match[1]
		const suffixMatch = COMPONENT_SUFFIX_REGEX.exec(tagName)
		if (!suffixMatch) continue

		const suffix = suffixMatch[1] as 'component' | 'layout'
		const baseName = tagName.replace(COMPONENT_SUFFIX_REGEX, '')
		const importName = kebabToCamelCase(baseName)
		const importedSpecifier = imports.get(importName)

		if (!importedSpecifier || !isValidTemplateImportSpecifier(importedSpecifier)) {
			const nameRange = findTagNameRange(match.index, tagName)
			pushOffsetDiagnostic(
				diagnostics,
				document,
				nameRange.start,
				nameRange.end,
				`Component '${baseName}' is not imported. Explicit imports are required.`,
				'AERO_RESOLVE',
				'error'
			)
			continue
		}

		const resolved = resolver.resolve(importedSpecifier, document.uri.fsPath)
		if (!resolved) {
			const nameRange = findTagNameRange(match.index, tagName)
			pushOffsetDiagnostic(
				diagnostics,
				document,
				nameRange.start,
				nameRange.end,
				`${suffix === 'component' ? 'Component' : 'Layout'} file not found: ${baseName}.html`,
				'AERO_RESOLVE',
				'warning'
			)
		}
	}
}
