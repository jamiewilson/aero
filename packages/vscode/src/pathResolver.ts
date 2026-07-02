/**
 * VS Code adapter over core path resolution.
 */
import * as vscode from 'vscode'
import {
	getResolver as getCoreResolver,
	clearResolverCache,
	type PathResolver,
} from '@aero-js/core/template-diagnostics'

export { clearResolverCache, type PathResolver }

export function getResolver(document: vscode.TextDocument): PathResolver {
	const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
	return getCoreResolver(document.uri.fsPath, workspaceRoot)
}
