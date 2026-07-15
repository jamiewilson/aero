import * as vscode from 'vscode'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { aeroIdeDocsUrlForDiagnostic } from '@aero-js/diagnostics/ide-catalog'

const DIAGNOSTIC_SOURCE = 'aero'

export function mapAeroDiagnosticToVscode(diagnostic: AeroDiagnostic): vscode.Diagnostic {
	const span = diagnostic.span
	const range =
		span ?
			new vscode.Range(
				new vscode.Position(span.line, span.column),
				new vscode.Position(span.lineEnd ?? span.line, span.columnEnd ?? span.column + 1)
			)
		:	new vscode.Range(0, 0, 0, 0)

	const severity =
		diagnostic.severity === 'warning' ? vscode.DiagnosticSeverity.Warning
		: diagnostic.severity === 'info' ? vscode.DiagnosticSeverity.Hint
		: vscode.DiagnosticSeverity.Error

	const out = new vscode.Diagnostic(range, diagnostic.message, severity)
	out.source = DIAGNOSTIC_SOURCE
	out.code = {
		value: diagnostic.code,
		target: vscode.Uri.parse(aeroIdeDocsUrlForDiagnostic(diagnostic)),
	}

	if (diagnostic.severity === 'info') {
		out.tags = [vscode.DiagnosticTag.Unnecessary]
	}

	return out
}
