/**
 * Aero config types: user config shape, env-aware function, and resolved config with env.
 *
 * @remarks
 * Used by `aero.config.ts` and by `createViteConfig` to build the final Vite config.
 * `AeroConfig` extends `AeroOptions` with orchestration-only fields (`vite`, `incremental`).
 */
import type { UserConfig } from 'vite'
import type { AeroOptions } from '../types'

/** User-facing Aero configuration: plugin options plus optional Vite merge and incremental build flag. */
export interface AeroConfig extends AeroOptions {
	/** Vite configuration merged with Aero defaults (plugins, build, etc.). */
	vite?: UserConfig

	/**
	 * When `true` and `vite build`, sets `AERO_INCREMENTAL=1` if the env var is unset (incremental
	 * static prerender + content disk cache). Explicit `AERO_INCREMENTAL` in the environment always wins.
	 */
	incremental?: boolean
}

/** Resolved config plus environment (used internally when invoking config function). */
export interface AeroConfigWithEnv {
	config: AeroConfig
	command: 'dev' | 'build'
	mode: 'development' | 'production'
}

/** Config as a function of env (command, mode); allows different settings for dev vs build. */
export type AeroConfigFunction = (env: {
	command: 'dev' | 'build'
	mode: 'development' | 'production'
}) => AeroConfig

/** Either a static config object or a function that returns config. */
export type AeroUserConfig = AeroConfig | AeroConfigFunction
