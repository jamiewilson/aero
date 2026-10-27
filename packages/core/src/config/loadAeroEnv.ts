import { loadEnv } from 'vite'

import type { CreateViteConfigOptions } from './createViteConfig'

/**
 * Merge Vite mode env files into `process.env` for Aero build-time vars (`AERO_*`).
 * Does not overwrite keys already set in `process.env`.
 */
export function loadAeroEnv(mode: string, envDir?: string): void
/** Load env from a Vite `defineConfig` callback env (includes `envDir` when set). */
export function loadAeroEnv(env: AeroViteConfigEnv): void
export function loadAeroEnv(modeOrEnv: string | AeroViteConfigEnv, envDir?: string): void {
	if (typeof modeOrEnv === 'object') {
		loadAeroEnv(modeOrEnv.mode, modeOrEnv.envDir ?? process.cwd())
		return
	}
	const dir = envDir ?? process.cwd()
	const loaded = loadEnv(modeOrEnv, dir, '')
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

/** Map Vite's config env to {@link createViteConfig} options (custom modes → production for Aero config fn). */
export function toAeroConfigEnv(env: AeroViteConfigEnv): CreateViteConfigOptions {
	return {
		command: env.command === 'serve' ? 'dev' : 'build',
		mode: env.mode === 'development' ? 'development' : 'production',
	}
}

export function isAeroViteConfigEnv(
	options: CreateViteConfigOptions | AeroViteConfigEnv
): options is AeroViteConfigEnv {
	if (options.command === 'serve') return true
	if ('envDir' in options && options.envDir !== undefined) return true
	return options.mode !== 'development' && options.mode !== 'production'
}

/** @deprecated Use {@link loadAeroEnv}. */
export function applyAeroViteEnv(mode: string, envDir: string = process.cwd()): void {
	loadAeroEnv(mode, envDir)
}

/** @deprecated Use {@link loadAeroEnv}. */
export function applyAeroViteEnvFromVite(env: AeroViteConfigEnv): void {
	loadAeroEnv(env)
}

/** @deprecated Use {@link toAeroConfigEnv}. */
export function viteEnvToCreateViteConfigOptions(env: AeroViteConfigEnv): CreateViteConfigOptions {
	return toAeroConfigEnv(env)
}
