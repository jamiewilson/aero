/**
 * Aero VS Code extension entry: registers language providers, starts the Volar-based
 * language server, and wires cache invalidation.
 *
 * @remarks
 * Starts a Volar language server for TypeScript IntelliSense inside script blocks, and
 * registers definition, completion, hover, and diagnostics for HTML files in Aero projects
 * while preserving native HTML language identity. Clears path/scope caches on relevant
 * project config changes.
 */
import * as vscode from 'vscode'
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
import { registerDiagnostics } from './diagnostics/index'
import { registerAeroCodeActions } from './aero-code-actions'
import { registerAeroTasks } from './aero-tasks'
import { registerRunAeroCheck } from './runCheck'
import { clearResolverCache } from './pathResolver'
import {
	clearScopeCache,
	setScopeDebugLogger,
} from './scope'
import { HTML_SELECTOR } from './constants'

let languageClient: LanguageClient | undefined
let outputChannel: vscode.OutputChannel | undefined
let reindexTimer: ReturnType<typeof setTimeout> | undefined

function isDebugEnabled(): boolean {
	return vscode.workspace.getConfiguration('aero').get<boolean>('debug', false) === true
}

function configureScopeLogger(): void {
	const enabled = isDebugEnabled()
	if (!enabled) {
		setScopeDebugLogger(undefined)
		return
	}
	if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Aero')
	setScopeDebugLogger(message => {
		outputChannel?.appendLine(`[scope] ${message}`)
	})
	outputChannel.appendLine('[scope] debug logging enabled')
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	configureScopeLogger()
	outputChannel?.appendLine('[scope] extension activated')

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
		documentSelector: [{ language: 'html' }],
		initializationOptions: {
			typescript: { tsdk: tsdk?.tsdk },
		},
	}

	languageClient = new LanguageClient(
		'aero-language-server',
		'Aero Language Server',
		serverOptions,
		clientOptions
	)

	await languageClient.start()
	context.subscriptions.push({ dispose: () => languageClient?.stop() })

	// ---- Completion Provider ----
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			HTML_SELECTOR,
			new AeroCompletionProvider(),
			'<',
			'/',
			'@',
			'"',
			"'"
		)
	)

	// ---- Hover Provider ----
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(HTML_SELECTOR, new AeroHoverProvider())
	)

	// ---- Diagnostics ----
	registerDiagnostics(context)

	registerRunAeroCheck(context)
	registerAeroCodeActions(context)
	registerAeroTasks(context)

	// ---- Definition Provider ----
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(HTML_SELECTOR, new AeroDefinitionProvider())
	)

	// ---- Cache invalidation ----
	const invalidateScope = (reason: string): void => {
		outputChannel?.appendLine(`[scope] invalidate: ${reason}`)
		clearResolverCache()
		clearScopeCache()
		if (reindexTimer) clearTimeout(reindexTimer)
		reindexTimer = setTimeout(() => undefined, 100)
	}

	for (const pattern of [
		'**/tsconfig.json',
		'**/package.json',
		'**/vite.config.ts',
		'**/vite.config.js',
		'**/vite.config.mts',
		'**/vite.config.mjs',
		'**/aero.config.ts',
		'**/aero.config.js',
		'**/aero.config.mts',
		'**/aero.config.mjs',
	]) {
		const watcher = vscode.workspace.createFileSystemWatcher(pattern)
		watcher.onDidChange(uri => invalidateScope(`change ${uri.fsPath}`))
		watcher.onDidCreate(uri => invalidateScope(`create ${uri.fsPath}`))
		watcher.onDidDelete(uri => invalidateScope(`delete ${uri.fsPath}`))
		context.subscriptions.push(watcher)
	}

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('aero.debug')) {
				configureScopeLogger()
			}
		})
	)
}

/** Called when the extension is deactivated; stops the language server and clears caches. */
export async function deactivate(): Promise<void> {
	await languageClient?.stop()
	languageClient = undefined
	clearResolverCache()
	clearScopeCache()
	if (reindexTimer) clearTimeout(reindexTimer)
	outputChannel?.dispose()
	outputChannel = undefined
}
