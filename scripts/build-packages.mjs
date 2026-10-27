#!/usr/bin/env node
/**
 * Build published @aero-js/* packages in dependency order (no Vite+ task graph).
 * Keep in sync with BUILD_PACKAGES in vite.config.ts.
 */
import { spawnSync } from 'node:child_process'

const BUILD_PACKAGES = [
	'@aero-js/interpolation',
	'@aero-js/html-parser',
	'@aero-js/highlight',
	'@aero-js/diagnostics',
	'@aero-js/compiler',
	'@aero-js/prettier-plugin-aero',
	'@aero-js/reactivity',
	'@aero-js/hypermedia',
	'@aero-js/core',
	'@aero-js/content',
	'@aero-js/cli',
]

for (const name of BUILD_PACKAGES) {
	const result = spawnSync('pnpm', ['--filter', name, 'run', 'build'], {
		stdio: 'inherit',
		shell: true,
	})
	if (result.status !== 0) {
		process.exit(result.status ?? 1)
	}
}
