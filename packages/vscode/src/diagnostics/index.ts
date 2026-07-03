import * as vscode from 'vscode'
import { collectTemplateDiagnostics } from '@aero-js/core/template-diagnostics'
import { isAeroDocument } from '../scope'
import { mapAeroDiagnosticToVscode } from './map-aero-diagnostic'

export function collectDiagnosticsForDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
	const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath

	return collectTemplateDiagnostics({
		document,
		root: workspaceRoot ?? document.uri.fsPath,
		workspaceRoot,
	}).map(mapAeroDiagnosticToVscode)
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
