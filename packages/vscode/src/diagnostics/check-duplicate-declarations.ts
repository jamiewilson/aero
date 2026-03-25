import * as vscode from 'vscode'
import type { ParsedDocument } from '../document-analysis'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'

export function checkDuplicateDeclarations(
	parsed: ParsedDocument,
	diagnostics: vscode.Diagnostic[]
): void {
	for (const dup of parsed.duplicateDeclarations) {
		const diagnostic = new vscode.Diagnostic(
			dup.range,
			`'${dup.name}' is declared multiple times (as '${dup.kind1}' and '${dup.kind2}').`,
			vscode.DiagnosticSeverity.Error
		)
		applyAeroDiagnosticIdentity(diagnostic, 'AERO_BUILD_SCRIPT', 'script-taxonomy.md')
		diagnostics.push(diagnostic)
	}
}
