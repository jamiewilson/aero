/**
 * Contributes a workspace task to run `aero check` (local binary / package-manager exec when possible).
 */
import * as vscode from 'vscode'
import { resolveAeroCheckCommand } from './resolve-aero-check-command'

const TASK_TYPE = 'aero'

/**
 * Register an Aero task provider so **Tasks: Run Task** can list `aero: check`.
 */
export function registerAeroTasks(context: vscode.ExtensionContext): void {
	const provider = vscode.tasks.registerTaskProvider(TASK_TYPE, {
		provideTasks(): vscode.ProviderResult<vscode.Task[]> {
			const folder = vscode.workspace.workspaceFolders?.[0]
			if (!folder) return []
			const def: vscode.TaskDefinition = { type: TASK_TYPE, task: 'check' }
			const commandLine = resolveAeroCheckCommand(folder.uri.fsPath)
			const exec = new vscode.ShellExecution(commandLine, {
				cwd: folder.uri.fsPath,
			})
			const task = new vscode.Task(def, folder, 'check', 'aero', exec)
			task.presentationOptions = {
				reveal: vscode.TaskRevealKind.Always,
				panel: vscode.TaskPanelKind.Shared,
				focus: false,
				echo: true,
			}
			task.group = vscode.TaskGroup.Build
			return [task]
		},
		resolveTask(): vscode.Task | undefined {
			return undefined
		},
	})
	context.subscriptions.push(provider)
}
