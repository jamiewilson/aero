import * as vscode from 'vscode'
import { AeroDefinitionProvider } from './definitionProvider'
import { AeroCompletionProvider } from './completionProvider'
import { AeroHoverProvider } from './hoverProvider'
import { AeroDiagnostics } from './diagnostics'
import { clearResolverCache } from './pathResolver'
import { clearScopeCache } from './scope'
import { HTML_SELECTOR } from './constants'

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
	// ---- Definition Provider (Phase 2) ----
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(HTML_SELECTOR, new AeroDefinitionProvider()),
	)

	// ---- Completion Provider (Phase 3) ----
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			HTML_SELECTOR,
			new AeroCompletionProvider(),
			'<', // trigger on opening tag
			'/', // trigger for path completions
			'@', // trigger for alias completions
			'"', // trigger inside attribute values
			"'", // trigger inside attribute values
		),
	)

	// ---- Hover Provider (Phase 3) ----
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(HTML_SELECTOR, new AeroHoverProvider()),
	)

	// ---- Diagnostics (Phase 3) ----
	const diagnostics = new AeroDiagnostics(context)
	context.subscriptions.push(diagnostics)

	// ---- Cache invalidation ----
	// Clear caches when tsconfig or workspace changes
	const tsconfigWatcher = vscode.workspace.createFileSystemWatcher('**/tsconfig.json')
	tsconfigWatcher.onDidChange(() => {
		clearResolverCache()
		clearScopeCache()
	})
	tsconfigWatcher.onDidCreate(() => {
		clearResolverCache()
		clearScopeCache()
	})
	tsconfigWatcher.onDidDelete(() => {
		clearResolverCache()
		clearScopeCache()
	})
	context.subscriptions.push(tsconfigWatcher)

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('aero.scopeMode')) {
				clearScopeCache()
			}
		}),
	)
}

export function deactivate(): void {
	clearResolverCache()
	clearScopeCache()
}
