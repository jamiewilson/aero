/**
 * Diagnostic check: template imports must include an explicit `.html` extension.
 */
import * as vscode from 'vscode'
import { analyzeBuildScriptForEditor } from '@aero-js/core/editor'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'
import { isTemplateAliasSpecifier } from '../importResolution'
import { parseScriptBlocks } from '../script-tag'

export function checkTemplateImportSpecifiers(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[]
): void {
	for (const block of parseScriptBlocks(text)) {
		if (block.kind !== 'build') continue
		if (!block.content.trim()) continue

		let imports: ReturnType<typeof analyzeBuildScriptForEditor>['imports'] = []
		try {
			imports = analyzeBuildScriptForEditor(block.content).imports
		} catch {
			continue
		}

		for (const imp of imports) {
			if (!isTemplateAliasSpecifier(imp.specifier) || imp.specifier.endsWith('.html')) continue

			const [specStart, specEnd] = imp.specifierRange
			const absStart = block.contentStart + specStart
			const absEnd = block.contentStart + specEnd
			const diagnostic = new vscode.Diagnostic(
				new vscode.Range(document.positionAt(absStart), document.positionAt(absEnd)),
				`Template imports must include the .html extension (for example '${imp.specifier}.html').`,
				vscode.DiagnosticSeverity.Error
			)
			applyAeroDiagnosticIdentity(diagnostic, 'AERO_RESOLVE', 'importing-and-bundling.md')
			diagnostics.push(diagnostic)
		}
	}
}
