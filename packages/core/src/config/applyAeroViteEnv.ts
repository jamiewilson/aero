import { loadEnv } from 'vite'

import type { CreateViteConfigOptions } from './createViteConfig'

/**
 * Merge Vite mode env files into `process.env` for Aero build-time vars (`AERO_*`).
 * Call at the start of a `defineConfig` callback so `.env.[mode]` applies before Aero plugins run.
 */
export function applyAeroViteEnv(mode: string, envDir: string = process.cwd()): void {
	const loaded = loadEnv(mode, envDir, '')
	for (const [key, value] of Object.entries(loaded)) {
		if (process.env[key] === undefined) process.env[key] = value
	}
}

/** Map Vite's config env to {@link createViteConfig} options (custom modes → production for Aero config fn). */
export function viteEnvToCreateViteConfigOptions(env: {
	command: 'build' | 'serve'
	mode: string
}): CreateViteConfigOptions {
	return {
		command: env.command === 'serve' ? 'dev' : 'build',
		mode: env.mode === 'development' ? 'development' : 'production',
	}
}
