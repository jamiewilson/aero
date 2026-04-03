import * as vscode from 'vscode'
import { parseDocument } from '../document-analysis'
import { getResolver } from '../pathResolver'
import { isAeroDocument } from '../scope'
import { checkComponentProps } from './check-component-props'
import { checkComponentReferences } from './check-component-references'
import { checkConditionalChains } from './check-conditional-chains'
import { checkDirectiveExpressionBraces } from './check-directive-braces'
import { checkDuplicateDeclarations } from './check-duplicate-declarations'
import { checkScriptTags } from './check-script-tags'
import { checkUndefinedVariables } from './check-undefined-variables'
import { checkUnusedVariables } from './check-unused-variables'

export function collectDiagnosticsForDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
	const parsed = parseDocument(document)
	const diagnostics: vscode.Diagnostic[] = []
	const resolver = getResolver(document)
	const { text } = parsed

	checkScriptTags(document, text, diagnostics, parsed)
	checkConditionalChains(document, text, diagnostics)
	checkDirectiveExpressionBraces(document, text, diagnostics)
	checkComponentReferences(document, text, diagnostics, resolver)
	checkComponentProps(document, text, diagnostics, resolver, parsed.definedVariables)
	const regexUndefined =
		vscode.workspace
			.getConfiguration('aero')
			.get<boolean>('diagnostics.regexUndefinedVariables') === true
	if (regexUndefined) {
		checkUndefinedVariables(parsed, diagnostics)
	}
	checkUnusedVariables(parsed, diagnostics)
	checkDuplicateDeclarations(parsed, diagnostics)

	return diagnostics
}

export function registerDiagnostics(context: vscode.ExtensionContext): vscode.Disposable {
	const collection = vscode.languages.createDiagnosticCollection('aero')
	const disposables: vscode.Disposable[] = []

	const updateDiagnostics = (document: vscode.TextDocument): void => {
		if (!isAeroDocument(document)) {
			collection.delete(document.uri)
			return
		}

		collection.set(document.uri, collectDiagnosticsForDocument(document))
	}

	disposables.push(
		vscode.workspace.onDidOpenTextDocument(doc => updateDiagnostics(doc)),
		vscode.workspace.onDidSaveTextDocument(doc => updateDiagnostics(doc)),
		vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document)),
		vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
	)

	for (const doc of vscode.workspace.textDocuments) {
		updateDiagnostics(doc)
	}

	const disposable: vscode.Disposable = {
		dispose(): void {
			collection.dispose()
			for (const d of disposables) d.dispose()
		},
	}

	context.subscriptions.push(disposable)
	return disposable
}
