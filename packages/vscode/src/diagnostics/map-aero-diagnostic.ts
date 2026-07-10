import * as vscode from 'vscode'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { aeroIdeDocHref, aeroIdeDocsUrlForCode } from '@aero-js/diagnostics/ide-catalog'

const DIAGNOSTIC_SOURCE = 'aero'

const CODE_DOC_FILES: Partial<Record<AeroDiagnostic['code'], string>> = {
	AERO_BUILD_SCRIPT: 'script-taxonomy.md',
	AERO_SCRIPT: 'script-taxonomy.md',
	AERO_COMPILE: 'interpolation.md',
	AERO_CONFIG: 'aero-config.md',
	AERO_RESOLVE: 'importing-and-bundling.md',
	AERO_ROUTE: 'routing.md',
}

function resolveDocFile(diagnostic: AeroDiagnostic): string | undefined {
	if (diagnostic.docsUrl) return undefined
	const mapped = CODE_DOC_FILES[diagnostic.code]
	if (mapped && diagnostic.code !== 'AERO_COMPILE') return mapped
	if (diagnostic.code === 'AERO_COMPILE') {
		if (/prop/i.test(diagnostic.message)) return 'props.md'
		if (/readonly|state variable|reactive/i.test(diagnostic.message)) return 'reactivity.md'
		return mapped
	}
	return mapped
}

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
	const docFile = resolveDocFile(diagnostic)
	const href = diagnostic.docsUrl ?? (docFile ? aeroIdeDocHref(docFile) : aeroIdeDocsUrlForCode(diagnostic.code))
	out.code = { value: diagnostic.code, target: vscode.Uri.parse(href) }

	if (diagnostic.severity === 'info') {
		out.tags = [vscode.DiagnosticTag.Unnecessary]
	}

	return out
}
