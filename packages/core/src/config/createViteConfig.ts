/**
 * Build the final Vite config from Aero config: resolve config function and apply Aero plugins.
 *
 * @remarks
 * Invokes `aeroConfig` with env if it's a function, then builds base config (defaultViteConfig + aero plugins).
 * Vite-specific settings (plugins, build, aliases) belong in `vite.config.ts`, not `aero.config.ts`.
 * When called with no args, loads aero.config.ts from process.cwd() if present.
 */
import type { UserConfig } from 'vite'
import type { AeroOptions, AeroOptionsFn } from '../types'

import { aero } from '../vite/index'
import { defaultViteConfig } from './defaults'
import { loadAeroConfig } from './loadAeroConfig'

/** Environment passed to createViteConfig (command and mode). */
export interface CreateViteConfigOptions {
	command: 'dev' | 'build'
	mode: 'development' | 'production'
}

/** Derive command and mode from argv/NODE_ENV. Use with createViteConfig(aeroConfig, getDefaultOptions()). */
export function getDefaultOptions(): CreateViteConfigOptions {
	return {
		command: process.argv.includes('build') ? 'build' : 'dev',
		mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
	}
}

/**
 * Create the Vite UserConfig from Aero config and env.
 *
 * When called with no arguments, loads aero.config.ts (or .js/.mjs) from process.cwd() if present;
 * otherwise uses empty config. Command and mode are derived from argv and NODE_ENV.
 *
 * @param aeroConfigOrOptions - Optional: static config, config function, or options. Omit to auto-load aero.config.
 * @param options - Optional when first arg is config. Command and mode (defaults from argv/NODE_ENV when using no-arg form).
 * @returns Vite config (defaults + Aero plugins). Merge further in `vite.config.ts` for project-specific Vite settings.
 */
export function createViteConfig(
	aeroConfigOrOptions?: AeroOptions | AeroOptionsFn | CreateViteConfigOptions,
	options?: CreateViteConfigOptions
): UserConfig {
	let aeroConfig: AeroOptions | AeroOptionsFn
	let opts: CreateViteConfigOptions

	const isOptionsObject = (x: unknown): x is CreateViteConfigOptions =>
		typeof x === 'object' && x !== null && 'command' in x && 'mode' in x

	const hasExplicitConfig =
		aeroConfigOrOptions !== undefined &&
		(typeof aeroConfigOrOptions === 'function' ||
			(typeof aeroConfigOrOptions === 'object' && !isOptionsObject(aeroConfigOrOptions)))

	if (hasExplicitConfig) {
		aeroConfig = aeroConfigOrOptions as AeroOptions | AeroOptionsFn
		opts = options ?? getDefaultOptions()
	} else {
		opts = isOptionsObject(aeroConfigOrOptions) ? aeroConfigOrOptions : getDefaultOptions()
		// Same as historical behavior: one sync load; null → empty config (no second load / Effect on hot path).
		const loaded = loadAeroConfig(process.cwd())
		aeroConfig = loaded ?? {}
	}

	return createViteConfigFromAero(aeroConfig, opts)
}

function createViteConfigFromAero(
	aeroConfig: AeroOptions | AeroOptionsFn,
	options: CreateViteConfigOptions
): UserConfig {
	const resolvedConfig =
		typeof aeroConfig === 'function'
			? aeroConfig({ command: options.command, mode: options.mode })
			: aeroConfig

	return {
		...defaultViteConfig,
		plugins: aero(resolvedConfig),
	}
}
