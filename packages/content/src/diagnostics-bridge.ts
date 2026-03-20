/**
 * Map content collection schema issues to the shared {@link AeroDiagnostic} shape from `@aero-js/core`.
 */

import type { AeroDiagnostic, AeroDiagnosticSeverity } from '@aero-js/diagnostics'
import { contentSchemaIssuePayloadsToDiagnostics } from '@aero-js/diagnostics'
import type { ContentSchemaIssue } from './types'

/**
 * Convert aggregated content schema failures to Aero diagnostics (one per file).
 *
 * @param issues - From `loadAllCollections().schemaIssues`.
 * @param severity - `warning` when files are skipped (default); `error` when using strict mode.
 */
export function contentSchemaIssuesToAeroDiagnostics(
	issues: readonly ContentSchemaIssue[],
	severity: AeroDiagnosticSeverity = 'warning',
): AeroDiagnostic[] {
	return contentSchemaIssuePayloadsToDiagnostics(issues, severity)
}
