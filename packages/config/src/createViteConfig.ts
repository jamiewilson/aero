/**
 * Build the final Vite config from Aero config: resolve config function, merge Aero + content plugins and user vite overrides.
 *
 * @remarks
 * Invokes `aeroConfig` with env if it's a function, then builds base config (defaultViteConfig + aero plugin + optional aeroContent).
 * User `vite` is merged via Vite's mergeConfig; explicit `minify`/`cssMinify` from base are preserved when user sets them to true/null.
 * When called with no args, loads aero.config.ts from process.cwd() if present.
 */
import { mergeConfig } from 'vite'
import { Effect } from 'effect'
import { aero } from '@aero-js/vite'
import { aeroContent } from '@aero-js/content/vite'
import type { UserConfig } from 'vite'
import type { AeroConfig, AeroConfigFunction } from './types'
import { defaultViteConfig } from './defaults'
import { loadAeroConfig } from './loadAeroConfig'
import { loadResolvedAeroConfigEffect } from './load-aero-config-effect'

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
 * @returns Merged Vite config (defaults + Aero plugins + user vite; minify/cssMinify preserved when user overrides).
 */
export function createViteConfig(
	aeroConfigOrOptions?: AeroConfig | AeroConfigFunction | CreateViteConfigOptions,
	options?: CreateViteConfigOptions
): UserConfig {
	let aeroConfig: AeroConfig | AeroConfigFunction
	let opts: CreateViteConfigOptions

	const isOptionsObject = (x: unknown): x is CreateViteConfigOptions =>
		typeof x === 'object' && x !== null && 'command' in x && 'mode' in x

	const hasExplicitConfig =
		aeroConfigOrOptions !== undefined &&
		(typeof aeroConfigOrOptions === 'function' ||
			(typeof aeroConfigOrOptions === 'object' && !isOptionsObject(aeroConfigOrOptions)))

	if (hasExplicitConfig) {
		aeroConfig = aeroConfigOrOptions as AeroConfig | AeroConfigFunction
		opts = options ?? getDefaultOptions()
	} else {
		opts = isOptionsObject(aeroConfigOrOptions) ? aeroConfigOrOptions : getDefaultOptions()
		// Keep no-arg createViteConfig compatible, while centralizing optional env-policy/defaulting
		// in the Effect-based config pipeline.
		const loaded = loadAeroConfig(process.cwd())
		aeroConfig =
			loaded ??
			Effect.runSync(
				loadResolvedAeroConfigEffect(process.cwd(), {
					command: opts.command,
					mode: opts.mode,
				})
			)
	}

	return createViteConfigFromAero(aeroConfig, opts)
}

function createViteConfigFromAero(
	aeroConfig: AeroConfig | AeroConfigFunction,
	options: CreateViteConfigOptions
): UserConfig {
	const resolvedConfig =
		typeof aeroConfig === 'function'
			? aeroConfig({ command: options.command, mode: options.mode })
			: aeroConfig

	const {
		content,
		server,
		site,
		dirs,
		redirects,
		middleware,
		vite: userViteConfig,
	} = resolvedConfig

	const contentOptions = content === true ? {} : typeof content === 'object' ? content : undefined
	const basePlugins: UserConfig['plugins'] = [
		aero({
			server: server ?? false,
			site,
			dirs,
			redirects,
			middleware,
			staticServerPlugins: contentOptions !== undefined ? [aeroContent(contentOptions)] : undefined,
		}),
	]
	if (contentOptions !== undefined) {
		basePlugins.push(aeroContent(contentOptions))
	}

	const baseConfig: UserConfig = {
		...defaultViteConfig,
		plugins: basePlugins,
	}

	if (!userViteConfig) {
		return baseConfig
	}

	const merged = mergeConfig(baseConfig, userViteConfig)

	if (merged.build) {
		if (merged.build.minify === true || merged.build.minify === null) {
			if (baseConfig.build?.minify !== undefined) {
				merged.build.minify = baseConfig.build.minify
			}
		}
		if (merged.build.cssMinify === true || merged.build.cssMinify === null) {
			if (baseConfig.build?.cssMinify !== undefined) {
				merged.build.cssMinify = baseConfig.build.cssMinify
			}
		}
	}

	return merged
}
