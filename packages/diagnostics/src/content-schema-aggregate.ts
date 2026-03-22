/**
 * Duck-typed handling for `@aero-js/content` `ContentSchemaAggregateError` without depending on that package.
 */

import type { AeroDiagnostic, AeroDiagnosticSeverity } from './types'

/** Payload shape mirrored from `ContentSchemaIssue` in `@aero-js/content`. */
export interface ContentSchemaIssuePayload {
	readonly collection: string
	readonly relPath: string
	readonly file: string
	readonly messages: readonly string[]
}

export function isContentSchemaAggregateError(
	err: unknown
): err is {
	readonly _tag: 'ContentSchemaAggregateError'
	readonly issues: readonly ContentSchemaIssuePayload[]
} {
	if (typeof err !== 'object' || err === null) return false
	const r = err as Record<string, unknown>
	return (
		r._tag === 'ContentSchemaAggregateError' &&
		Array.isArray(r.issues) &&
		r.issues.every(isContentSchemaIssuePayload)
	)
}

function isContentSchemaIssuePayload(v: unknown): v is ContentSchemaIssuePayload {
	if (typeof v !== 'object' || v === null) return false
	const x = v as Record<string, unknown>
	return (
		typeof x.collection === 'string' &&
		typeof x.relPath === 'string' &&
		typeof x.file === 'string' &&
		Array.isArray(x.messages) &&
		x.messages.every(m => typeof m === 'string')
	)
}

/**
 * Map content schema issue payloads to diagnostics (shared with `@aero-js/content` bridge).
 */
export function contentSchemaIssuePayloadsToDiagnostics(
	issues: readonly ContentSchemaIssuePayload[],
	severity: AeroDiagnosticSeverity = 'error'
): AeroDiagnostic[] {
	return issues.map(issue => ({
		code: 'AERO_CONTENT_SCHEMA',
		severity,
		file: issue.file,
		message: `Collection "${issue.collection}" (${issue.relPath}): ${issue.messages.join('; ')}`,
		hint: 'Fix frontmatter or adjust the collection schema.',
	}))
}
