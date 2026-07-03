import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
/**
 * Diagnostic check: script tag validation (missing type="module" on inline scripts with imports).
 */
import type { ParsedDocument } from '../document-analysis'
import { getIgnoredRanges, isInRanges, isInHead } from './helpers'

export function checkScriptTags(
	document: SourceDocument,
	text: string,
	diagnostics: AeroDiagnostic[],
	parsed: ParsedDocument
): void {
	const ignoredRanges = getIgnoredRanges(text)

	for (const block of parsed.scriptBlocks) {
		if (isInRanges(block.tagStart, ignoredRanges)) continue
		if (block.kind === 'external') continue

		// Skip scripts in <head> that might be third-party
		if (isInHead(text, block.tagStart)) continue

		// Check for imports in is:inline scripts (in body) without type="module"
		if (block.kind === 'inline') {
			const hasImport = /\bimport\b/.test(block.content)
			// HTML attribute names are case-insensitive, so use a case-insensitive match.
			// We also treat `module` value as case-insensitive to avoid surprising casing mismatches.
			const hasModuleType = /\btype\s*=\s*["']?module["']?\b/i.test(block.attrs)

			if (hasImport && !hasModuleType) {
				const importMatch = /\bimport\b/.exec(block.content)
				if (importMatch) {
					const importStart = block.contentStart + importMatch.index
					const importEnd = importStart + 6
					pushOffsetDiagnostic(
						diagnostics,
						document,
						importStart,
						importEnd,
						'Imports in <script is:inline> require type="module" attribute.',
						'AERO_BUILD_SCRIPT',
						'error'
					)
				}
			}
		}

		// Plain <script> without attributes are valid (bundled as module by default)
	}
}
