/**
 * Map thrown values to AeroDiagnostic[] for catch blocks before tagged errors exist everywhere.
 */

import path from 'node:path'
import type { AeroDiagnostic, AeroDiagnosticCode } from './types'
import { failureToAeroDiagnostics } from './cause-map'
import { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'
import {
	contentSchemaIssuePayloadsToDiagnostics,
	isContentSchemaAggregateError,
} from './content-schema-aggregate'
import { augmentFromCssSyntaxError } from './css-postcss-error'
import { diagnosticPathForDisplay } from './path-display'
import { firstStackSpan } from './stack-frame'

function isCompileError(err: unknown): err is { message: string; file?: string; line?: number; column?: number } {
	return err instanceof Error && err.name === 'CompileError'
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null
}

/**
 * Normalize unknown caught errors into one or more diagnostics.
 */
export function unknownToAeroDiagnostics(
	err: unknown,
	base: { file?: string; code?: AeroDiagnosticCode } = {}
): AeroDiagnostic[] {
	const code: AeroDiagnosticCode = base.code ?? 'AERO_COMPILE'
	const file = base.file

	if (err instanceof AeroBuildCancelledError) {
		return failureToAeroDiagnostics(err)
	}

	if (err instanceof AeroCompileError) {
		const fromTagged = failureToAeroDiagnostics(err)
		return fromTagged.map(d => (file && !d.file ? { ...d, file } : d))
	}

	if (isContentSchemaAggregateError(err)) {
		return contentSchemaIssuePayloadsToDiagnostics(err.issues).map(d =>
			file && !d.file ? { ...d, file } : d
		)
	}

	if (isCompileError(err)) {
		const span =
			err.file !== undefined && err.line !== undefined
				? {
						file: err.file,
						line: err.line,
						column: err.column ?? 0,
					}
				: undefined
		return [
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: err.message,
				file: err.file,
				span,
			},
		]
	}

	if (err instanceof Error) {
		const contextFile = file
		const css = augmentFromCssSyntaxError(err)
		const stackSpan = css ? undefined : firstStackSpan(err.stack)
		let diagFile = css?.file ?? stackSpan?.file ?? contextFile
		let span =
			css?.span ??
			(stackSpan
				? {
						file: stackSpan.file,
						line: stackSpan.line,
						column: stackSpan.column,
					}
				: undefined)

		const promoteInlineCssPath =
			css != null &&
			Boolean(contextFile) &&
			css.hint?.includes('inline <style>') === true &&
			path.normalize(contextFile!) !== path.normalize(css.file)

		if (promoteInlineCssPath) {
			diagFile = contextFile!
			if (span) span = { ...span, file: contextFile! }
		}

		let hint: string | undefined
		if (css) {
			if (promoteInlineCssPath) {
				hint = css.hint
			} else {
				const parts: string[] = []
				if (css.hint) parts.push(css.hint)
				if (contextFile && path.normalize(contextFile) !== path.normalize(css.file)) {
					parts.push(`while rendering ${diagnosticPathForDisplay(contextFile)}`)
				}
				hint = parts.length > 0 ? parts.join('\n') : undefined
			}
		} else {
			hint =
				contextFile && stackSpan && path.normalize(contextFile) !== path.normalize(stackSpan.file)
					? `while rendering ${diagnosticPathForDisplay(contextFile)}`
					: undefined
		}

		return [
			{
				code,
				severity: 'error',
				message: css?.message ?? (err.message || String(err)),
				file: diagFile,
				span,
				...(css?.frame ? { frame: css.frame } : {}),
				...(hint ? { hint } : {}),
			},
		]
	}

	if (typeof err === 'string') {
		return [{ code, severity: 'error', message: err, file }]
	}

	if (isRecord(err) && typeof err.message === 'string') {
		return [{ code, severity: 'error', message: err.message, file }]
	}

	return [
		{
			code: 'AERO_INTERNAL',
			severity: 'error',
			message: `Unknown error: ${String(err)}`,
			file,
		},
	]
}
