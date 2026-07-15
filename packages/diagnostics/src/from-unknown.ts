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
import { tryRefineHtmlReferenceErrorSpan } from './refine-html-reference-error-span'
import { firstStackSpan } from './stack-frame'
import { stripAeroViteMessageDecorations } from './vite-error'

function isCompileError(
	err: unknown
): err is {
	message: string
	file?: string
	line?: number
	column?: number
	code?: 'AERO_COMPILE' | 'AERO_CONFIG'
} {
	return err instanceof Error && err.name === 'CompileError'
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null
}

interface ViteErrorMeta {
	id?: string
	frame?: string
	loc?: { file?: string; line?: number; column?: number }
}

function viteErrorMeta(err: Error): ViteErrorMeta {
	const record = err as Error & ViteErrorMeta
	return {
		...(typeof record.id === 'string' ? { id: record.id } : {}),
		...(typeof record.frame === 'string' ? { frame: record.frame } : {}),
		...(record.loc && typeof record.loc === 'object' ? { loc: record.loc } : {}),
	}
}

/**
 * Map a generic Error with contextFile-specific enrichment (CSS path promotion,
 * HTML reference span refinement, "while rendering" hint).
 *
 * This is the catch-block path that adds context-file awareness on top of the
 * shared `genericErrorToDiagnostic` logic.
 */
function errorWithContextToDiagnostic(
	err: Error,
	code: AeroDiagnosticCode,
	contextFile: string | undefined
): AeroDiagnostic {
	const css = augmentFromCssSyntaxError(err)
	const vite = viteErrorMeta(err)
	const parsedMessage = stripAeroViteMessageDecorations(err.message || String(err))
	const stackSpan = css || vite.loc || vite.id ? undefined : firstStackSpan(err.stack)
	let diagFile = css?.file ?? (vite.loc?.file || vite.id) ?? stackSpan?.file ?? contextFile
	let span =
		css?.span ??
		(vite.loc?.line !== undefined
			? {
					file: vite.loc.file ?? vite.id ?? diagFile ?? '',
					line: vite.loc.line,
					column: vite.loc.column ?? 0,
				}
			: stackSpan
				? { file: stackSpan.file, line: stackSpan.line, column: stackSpan.column }
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

	const refinedSpan = tryRefineHtmlReferenceErrorSpan(err, span, diagFile)
	if (refinedSpan) {
		span = refinedSpan
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
		const failingFile = diagFile ?? span?.file
		hint =
			contextFile && failingFile && path.normalize(contextFile) !== path.normalize(failingFile)
				? `while rendering ${diagnosticPathForDisplay(contextFile)}`
				: undefined
	}

	return {
		code: parsedMessage.code ?? code,
		severity: 'error',
		message: css?.message ?? parsedMessage.message,
		file: diagFile,
		span,
		...(css?.frame ? { frame: css.frame } : vite.frame ? { frame: vite.frame } : {}),
		...(hint ? { hint } : {}),
	}
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
				? { file: err.file, line: err.line, column: err.column ?? 0 }
				: undefined
		const compileCode = err.code === 'AERO_CONFIG' || err.code === 'AERO_COMPILE' ? err.code : 'AERO_COMPILE'
		return [
			{
				code: compileCode,
				severity: 'error',
				message: err.message,
				file: err.file,
				span,
			},
		]
	}

	if (err instanceof Error) {
		return [errorWithContextToDiagnostic(err, code, file)]
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
