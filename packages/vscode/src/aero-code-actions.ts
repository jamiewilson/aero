/**
 * Quick fixes for Aero diagnostics: open canonical documentation for stable `AERO_*` codes.
 */
import * as vscode from 'vscode'
import type { AeroDiagnosticCode } from '@aero-js/diagnostics'
import { aeroIdeDocsUrlForCode } from '@aero-js/diagnostics/ide-catalog'
import { HTML_SELECTOR } from './constants'

const AERO_SOURCE = 'aero'

function diagnosticCodeString(
	code: string | number | { value: string | number } | undefined
): string | null {
	if (code === undefined || code === null) return null
	if (typeof code === 'string') return code
	if (typeof code === 'number') return String(code)
	if (typeof code === 'object' && 'value' in code && code.value !== undefined) {
		return String(code.value)
	}
	return null
}

/**
 * Register "Open Aero documentation" quick fixes for Problems entries with Aero codes.
 */
export function registerAeroCodeActions(context: vscode.ExtensionContext): void {
	const provider = vscode.languages.registerCodeActionsProvider(
		HTML_SELECTOR,
		{
			provideCodeActions(
				_document: vscode.TextDocument,
				_range: vscode.Range | vscode.Selection,
				ctx: vscode.CodeActionContext
			): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
				const out: vscode.CodeAction[] = []
				for (const diag of ctx.diagnostics) {
					if (diag.source !== AERO_SOURCE) continue
					const codeStr = diagnosticCodeString(diag.code)
					if (!codeStr || !codeStr.startsWith('AERO_')) continue
					const href = aeroIdeDocsUrlForCode(codeStr as AeroDiagnosticCode)
					const title = `Open Aero docs (${codeStr})`
					const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix)
					action.command = {
						command: 'vscode.open',
						title: 'Open documentation',
						arguments: [vscode.Uri.parse(href)],
					}
					action.diagnostics = [diag]
					action.isPreferred = true
					out.push(action)
				}
				return out
			},
		},
		{ providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
	)
	context.subscriptions.push(provider)
}
