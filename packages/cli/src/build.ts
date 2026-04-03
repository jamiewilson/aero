/**
 * `aero build` — run `vite build` with optional incremental env (same as `AERO_INCREMENTAL`).
 */
import { build } from 'vite'
import { createViteConfig, getDefaultOptions } from '@aero-js/config/vite'

export type AeroBuildOptions = {
	/** Set `AERO_INCREMENTAL=1` when unset (matches `incremental: true` in aero.config). */
	incremental?: boolean
}

/**
 * Run production build using the project’s `vite.config` / `createViteConfig` from cwd `root`.
 */
export async function runAeroBuild(root: string, options: AeroBuildOptions = {}): Promise<void> {
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
	} finally {
		process.chdir(prev)
	}
}
