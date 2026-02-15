import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { AeroDefinitionProvider } from './definitionProvider'
import { AeroCompletionProvider } from './completionProvider'
import { AeroHoverProvider } from './hoverProvider'
import { AeroDiagnostics } from './diagnostics'
import { clearResolverCache } from './pathResolver'
import { HTML_SELECTOR } from './constants'

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
	// Detect whether any workspace folder looks like an Aero project
	if (!isAeroWorkspace()) {
		// Still activate for grammar injections (those work via contributes),
		// but skip registering providers that could interfere with non-Aero HTML.
		return
	}

	// ---- Definition Provider (Phase 2) ----
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(
			HTML_SELECTOR,
			new AeroDefinitionProvider(),
		),
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
		vscode.languages.registerHoverProvider(
			HTML_SELECTOR,
			new AeroHoverProvider(),
		),
	)

	// ---- Diagnostics (Phase 3) ----
	const diagnostics = new AeroDiagnostics(context)
	context.subscriptions.push(diagnostics)

	// ---- Cache invalidation ----
	// Clear resolver cache when tsconfig or workspace changes
	const tsconfigWatcher = vscode.workspace.createFileSystemWatcher('**/tsconfig.json')
	tsconfigWatcher.onDidChange(() => clearResolverCache())
	tsconfigWatcher.onDidCreate(() => clearResolverCache())
	tsconfigWatcher.onDidDelete(() => clearResolverCache())
	context.subscriptions.push(tsconfigWatcher)
}

export function deactivate(): void {
	clearResolverCache()
}

// ---------------------------------------------------------------------------
// Aero project detection
// ---------------------------------------------------------------------------

/**
 * Check whether any workspace folder is an Aero project.
 *
 * Heuristics (any match counts):
 * 1. A vite.config.ts/js that imports from '@aero-ssg' or 'aero'
 * 2. A tsconfig.json with Aero path aliases (@components/*, @layouts/*, etc.)
 * 3. A package.json with @aero-ssg/core or @aero-ssg/vite as a dependency
 */
function isAeroWorkspace(): boolean {
	const folders = vscode.workspace.workspaceFolders
	if (!folders) return false

	for (const folder of folders) {
		const root = folder.uri.fsPath

		// Check vite.config
		for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
			const viteConfig = path.join(root, name)
			if (fileContains(viteConfig, /aero/i)) return true
		}

		// Check tsconfig.json for Aero-style path aliases
		const tsconfig = path.join(root, 'tsconfig.json')
		if (fileContains(tsconfig, /@components\/\*/)) return true

		// Check package.json for @aero-ssg dependency
		const pkg = path.join(root, 'package.json')
		if (fileContains(pkg, /@aero-ssg/)) return true
	}

	return false
}

function fileContains(filePath: string, pattern: RegExp): boolean {
	try {
		if (!fs.existsSync(filePath)) return false
		const content = fs.readFileSync(filePath, 'utf-8')
		return pattern.test(content)
	} catch {
		return false
	}
}
