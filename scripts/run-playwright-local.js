#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const binary = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const playwrightArgs = process.argv.slice(2)
const separatorIndex = playwrightArgs.indexOf('--')

if (separatorIndex !== -1) {
	playwrightArgs.splice(separatorIndex, 1)
}

function run(args) {
	const result = spawnSync(binary, args, {
		stdio: 'inherit',
	})

	if (result.error) throw result.error
	if (typeof result.status === 'number' && result.status !== 0) process.exit(result.status)
	if (result.signal) process.kill(process.pid, result.signal)
}

run(['exec', 'playwright', 'install', 'chromium'])
run(['exec', 'playwright', ...playwrightArgs])
