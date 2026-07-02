import type { AeroDiagnostic, AeroDiagnosticCode } from '@aero-js/diagnostics'
import type { SourceDocument, SourceRange } from './source-document'
import { rangeFromOffsets } from './source-document'

export function pushSpanDiagnostic(
	out: AeroDiagnostic[],
	document: SourceDocument,
	range: SourceRange,
	message: string,
	code: AeroDiagnosticCode,
	severity: AeroDiagnostic['severity'] = 'error'
): void {
	out.push({
		code,
		severity,
		message,
		file: document.uri.fsPath,
		span: {
			file: document.uri.fsPath,
			line: range.start.line,
			column: range.start.character,
			lineEnd: range.end.line,
			columnEnd: range.end.character,
		},
	})
}

export function pushOffsetDiagnostic(
	out: AeroDiagnostic[],
	document: SourceDocument,
	start: number,
	end: number,
	message: string,
	code: AeroDiagnosticCode,
	severity: AeroDiagnostic['severity'] = 'error'
): void {
	pushSpanDiagnostic(out, document, rangeFromOffsets(document, start, end), message, code, severity)
}

export { rangeFromOffsets }
