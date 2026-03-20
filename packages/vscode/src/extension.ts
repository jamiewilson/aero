/**
 * Aero VS Code extension entry: registers language providers, starts the Volar-based
 * language server, auto-applies the `aero` language to HTML files in Aero projects,
 * and wires cache invalidation.
 *
 * @remarks
 * Starts a Volar language server for TypeScript IntelliSense inside script blocks, and
 * registers definition, completion, hover, and diagnostics for HTML/Aero files. Auto-switches
 * `.html` files to the `aero` language when they are in an Aero project so the custom grammar
 * (TypeScript in script blocks) applies. Clears path and scope caches when tsconfig or
 * aero.scopeMode changes.
 */
import * as vscode from 'vscode'
import * as fs from 'node:fs'
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from '@volar/vscode/node'
import { getTsdk } from '@volar/vscode'
import { AeroDefinitionProvider } from './definitionProvider'
import { AeroCompletionProvider } from './completionProvider'
import { AeroHoverProvider } from './hoverProvider'
import { AeroDiagnostics } from './diagnostics'
import { registerRunAeroCheck } from './runCheck'
import { clearResolverCache } from './pathResolver'
import { clearScopeCache, getScopeMode, isInAeroProjectPath } from './scope'
import { HTML_SELECTOR } from './constants'

let languageClient: LanguageClient | undefined

function shouldSwitchToAero(document: vscode.TextDocument): boolean {
	if (document.languageId !== 'html' || document.uri.scheme !== 'file') return false
	const mode = getScopeMode()
	if (mode === 'always') return true
	return isInAeroProjectPath(document.uri.fsPath)
}

async function trySetAeroLanguage(document: vscode.TextDocument): Promise<void> {
	if (!shouldSwitchToAero(document)) return
	try {
		await vscode.languages.setTextDocumentLanguage(document, 'aero')
	} catch {
		// Document may have been closed between check and switch
	}
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// ---- Language Server (Volar) ----
	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'dist', 'server.cjs')
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule.fsPath,
			transport: TransportKind.ipc,
		},
		debug: {
			module: serverModule.fsPath,
			transport: TransportKind.ipc,
			options: { execArgv: ['--nolazy', '--inspect=6009'] },
		},
	}

	const tsdk = await getTsdk(context)
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: 'aero' }],
		initializationOptions: {
			typescript: { tsdk: tsdk?.tsdk },
		},
		middleware: {
			provideDocumentLinks(document, token, next) {
				return Promise.resolve(next(document, token)).then(
					(links: vscode.DocumentLink[] | undefined | null) => {
						if (!links) return links
						return links.filter((link: vscode.DocumentLink) => {
							if (link.target?.scheme !== 'file') return true
							return fs.existsSync(link.target.fsPath)
						})
					},
				)
			},
		},
	}

	languageClient = new LanguageClient(
		'aero-language-server',
		'Aero Language Server',
		serverOptions,
		clientOptions,
	)
	await languageClient.start()
	context.subscriptions.push({ dispose: () => languageClient?.stop() })

	// ---- Auto-language switching ----
	for (const doc of vscode.workspace.textDocuments) {
		trySetAeroLanguage(doc)
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(doc => {
			trySetAeroLanguage(doc)
		}),
	)

	// ---- Completion Provider ----
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			HTML_SELECTOR,
			new AeroCompletionProvider(),
			'<',
			'/',
			'@',
			'"',
			"'",
		),
	)

	// ---- Hover Provider ----
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(HTML_SELECTOR, new AeroHoverProvider()),
	)

	// ---- Diagnostics ----
	const diagnostics = new AeroDiagnostics(context)
	context.subscriptions.push(diagnostics)

	registerRunAeroCheck(context)

	// ---- Definition Provider (register last so we win when selector scores tie) ----
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(HTML_SELECTOR, new AeroDefinitionProvider()),
	)

	// ---- Cache invalidation ----
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

/** Called when the extension is deactivated; stops the language server and clears caches. */
export async function deactivate(): Promise<void> {
	await languageClient?.stop()
	languageClient = undefined
	clearResolverCache()
	clearScopeCache()
}
