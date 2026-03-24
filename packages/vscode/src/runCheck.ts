/**
 * Command: run `aero check` in the workspace folder (pnpm/npm/npx fallback).
 */
import * as vscode from 'vscode'
import { resolveAeroCheckCommand } from './resolve-aero-check-command'

export function registerRunAeroCheck(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('aero.runCheck', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0]
			if (!folder) {
				void vscode.window.showWarningMessage('Aero: Open a folder to run aero check.')
				return
			}
			const root = folder.uri.fsPath
			const commandLine = resolveAeroCheckCommand(root)
			const task = new vscode.Task(
				{ type: 'shell', task: 'aero-check' },
				folder,
				'aero check',
				'aero',
				new vscode.ShellExecution(commandLine, { cwd: root }),
				[]
			)
			task.presentationOptions = {
				echo: true,
				reveal: vscode.TaskRevealKind.Always,
				focus: false,
				panel: vscode.TaskPanelKind.Shared,
				showReuseMessage: true,
				clear: false,
			}
			await vscode.tasks.executeTask(task)
		})
	)
}
