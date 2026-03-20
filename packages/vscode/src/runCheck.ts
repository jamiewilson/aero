/**
 * Command: run `aero check` in the workspace folder (pnpm/npm/npx fallback).
 */
import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'

export function registerRunAeroCheck(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('aero.runCheck', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0]
			if (!folder) {
				void vscode.window.showWarningMessage(
					'Aero: Open a folder to run aero check.'
				)
				return
			}
			const root = folder.uri.fsPath
			const commandLine = resolveCheckCommand(root)
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

function resolveCheckCommand(root: string): string {
	if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
		return 'pnpm exec aero check'
	}
	if (fs.existsSync(path.join(root, 'yarn.lock'))) {
		return 'yarn exec aero check'
	}
	if (fs.existsSync(path.join(root, 'package-lock.json'))) {
		return 'npx aero check'
	}
	return 'npx --yes @aero-js/cli check'
}
