import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
import type { ParsedDocument } from '../document-analysis'

export function checkDuplicateDeclarations(
	document: SourceDocument,
	parsed: ParsedDocument,
	diagnostics: AeroDiagnostic[]
): void {
	for (const dup of parsed.duplicateDeclarations) {
		pushSpanDiagnostic(diagnostics, document, dup.range, `'${dup.name}' is declared multiple times (as '${dup.kind1}' and '${dup.kind2}').`, 'AERO_BUILD_SCRIPT', 'error')
	}
}
