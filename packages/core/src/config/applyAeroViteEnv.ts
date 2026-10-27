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

/** `defineConfig` callback env; `envDir` is set at runtime but omitted from some vite-plus typings. */
export type AeroViteConfigEnv = {
	command: 'build' | 'serve'
	mode: string
	envDir?: string
}

/** Load mode env files before Aero plugins read `process.env` (use inside `defineConfig`). */
export function applyAeroViteEnvFromVite(env: AeroViteConfigEnv): void {
	applyAeroViteEnv(env.mode, env.envDir ?? process.cwd())
}

/** Map Vite's config env to {@link createViteConfig} options (custom modes → production for Aero config fn). */
export function viteEnvToCreateViteConfigOptions(env: AeroViteConfigEnv): CreateViteConfigOptions {
	return {
		command: env.command === 'serve' ? 'dev' : 'build',
		mode: env.mode === 'development' ? 'development' : 'production',
	}
}
