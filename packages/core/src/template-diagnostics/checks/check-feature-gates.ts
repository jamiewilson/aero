import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { collectFeatureGateIssuesFromSource, type FeatureGateFlags } from '@aero-js/compiler'
import { pushOffsetDiagnostic } from '../aero-diagnostic-build'
import type { SourceDocument } from '../source-document'

export function checkFeatureGates(
	document: SourceDocument,
	text: string,
	diagnostics: AeroDiagnostic[],
	flags: FeatureGateFlags
): void {
	for (const issue of collectFeatureGateIssuesFromSource(text, flags)) {
		const start = issue.start ?? 0
		const end = issue.end ?? Math.min(text.length, 1)
		pushOffsetDiagnostic(diagnostics, document, start, end, issue.message, issue.code, 'error')
	}
}

export type { FeatureGateFlags }
