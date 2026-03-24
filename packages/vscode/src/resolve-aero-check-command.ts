/**
 * Resolve the shell command to run `aero check` for a workspace root.
 * Prefers local `node_modules/.bin/aero` and package-manager exec; otherwise `npx --yes @aero-js/cli check`.
 */
import fs from 'node:fs'
import path from 'node:path'

export function resolveAeroCheckCommand(root: string): string {
	const nodeModulesBin = (name: string) => path.join(root, 'node_modules', '.bin', name)
	const localAeroBin =
		(fs.existsSync(nodeModulesBin('aero')) && nodeModulesBin('aero')) ||
		(fs.existsSync(nodeModulesBin('aero.cmd')) && nodeModulesBin('aero.cmd')) ||
		(fs.existsSync(nodeModulesBin('aero.ps1')) && nodeModulesBin('aero.ps1')) ||
		null

	if (localAeroBin) {
		if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm exec aero check'
		if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn exec aero check'
		if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm exec aero check'
		return `"${localAeroBin}" check`
	}

	return 'npx --yes @aero-js/cli check'
}
