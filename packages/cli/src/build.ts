/**
 * `aero build` — run `vite build` with optional incremental env (same as `AERO_INCREMENTAL`).
 */
import { build } from 'vite'
import { createViteConfig, getDefaultOptions } from '@aero-js/core/vite-config'
import { exitCodeForThrown } from '@aero-js/diagnostics'

type AeroBuildOptions = {
	/** Set `AERO_INCREMENTAL=1` when unset. */
	incremental?: boolean
}

/** Resolve CLI exit code after `vite build` (respects `process.exitCode` and thrown Aero errors). */
export function resolveAeroBuildExitCode(err?: unknown): number {
	if (err !== undefined) return exitCodeForThrown(err)
	return typeof process.exitCode === 'number' ? process.exitCode : 0
}

/**
 * Run production build using the project’s `vite.config` / `createViteConfig` from cwd `root`.
 */
export async function runAeroBuild(root: string, options: AeroBuildOptions = {}): Promise<number> {
	if (options.incremental) {
		const v = process.env.AERO_INCREMENTAL?.trim()
		if (v === undefined || v === '') {
			process.env.AERO_INCREMENTAL = '1'
		}
	}
	const prev = process.cwd()
	try {
		process.chdir(root)
		const viteConfig = createViteConfig(getDefaultOptions())
		await build(viteConfig)
		return resolveAeroBuildExitCode()
	} catch (err) {
		return resolveAeroBuildExitCode(err)
	} finally {
		process.chdir(prev)
	}
}
