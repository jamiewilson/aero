/**
 * Schema validation issue aggregation for content collections (terminal / Vite logger).
 *
 * @remarks
 * Terminal text uses `@aero-js/diagnostics` `formatDiagnosticsTerminal` (banner + File/Error lines).
 */

import { formatDiagnosticsTerminal } from '@aero-js/diagnostics'
import type { ContentSchemaIssue } from './types'
import { contentSchemaIssuesToAeroDiagnostics } from './diagnostics-bridge'
import { Data } from 'effect'

const LENIENT_FOOTER =
	'[aero:content] These files were skipped. ' +
	'Set strictSchema: true in content.config.ts or AERO_CONTENT_STRICT=1 to fail the build instead.'

/**
 * Lenient load: format all skipped files for Vite / terminal (warnings + footer).
 */
export function formatContentSchemaIssuesReport(issues: readonly ContentSchemaIssue[]): string {
	if (issues.length === 0) return ''
	const body = formatDiagnosticsTerminal(contentSchemaIssuesToAeroDiagnostics(issues, 'warning'))
	return `${body}\n\n${LENIENT_FOOTER}`
}

/** All schema validation failures from a load run (strict mode throws this). */
export class ContentSchemaAggregateError extends Data.TaggedError('ContentSchemaAggregateError')<{
	readonly issues: readonly ContentSchemaIssue[]
	readonly message: string
}> {}

export function contentSchemaAggregateError(
	issues: readonly ContentSchemaIssue[]
): ContentSchemaAggregateError {
	const message = formatDiagnosticsTerminal(contentSchemaIssuesToAeroDiagnostics(issues, 'error'))
	return new ContentSchemaAggregateError({
		issues,
		message,
	})
}
