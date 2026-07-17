import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { collectReactiveBindingIssuesFromHtml } from '@aero-js/compiler'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument } from '../source-document'
import type { ParsedDocument } from '../document-analysis'
import { hasStateScript } from './check-undefined-variables'

function offsetForLineColumn(text: string, line: number, column: number): number {
	const lines = text.split('\n')
	let offset = 0
	for (let i = 0; i < line - 1 && i < lines.length; i++) {
		offset += (lines[i]?.length ?? 0) + 1
	}
	return offset + Math.max(0, column)
}

/**
 * IDE parity with compile {@link collectReactiveBindingIssuesFromHtml}:
 * undeclared reactive names and class bindings that must reference state.
 */
export function checkReactiveBindingScope(
	document: SourceDocument,
	parsed: ParsedDocument,
	diagnostics: AeroDiagnostic[]
): void {
	if (!hasStateScript(parsed)) return

	const text = parsed.text
	const issues = collectReactiveBindingIssuesFromHtml(text, {
		root: '/',
		importer: document.uri.fsPath,
		resolvePath: (specifier: string) => specifier,
		reactivity: true,
	})

	for (const issue of issues) {
		if (issue.line !== undefined && issue.column !== undefined) {
			const start = offsetForLineColumn(text, issue.line, issue.column)
			const end = issue.name ? start + issue.name.length : Math.min(text.length, start + 1)
			const range = rangeFromOffsets(document, start, end)
			pushSpanDiagnostic(diagnostics, document, range, issue.message, 'AERO_COMPILE', 'error')
			continue
		}
		pushOffsetDiagnostic(diagnostics, document, 0, Math.min(1, text.length), issue.message, 'AERO_COMPILE', 'error')
	}
}
