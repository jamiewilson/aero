/**
 * Build the final Vite config from Aero config: resolve config function, merge Aero + content plugins and user vite overrides.
 *
 * @remarks
 * Invokes `aeroConfig` with env if it's a function, then builds base config (defaultViteConfig + aero plugin + optional aeroContent).
 * User `vite` is merged via Vite's mergeConfig; explicit `minify`/`cssMinify` from base are preserved when user sets them to true/null.
 */
import { mergeConfig } from 'vite'
import { aero } from '@aero-ssg/core/vite'
import { aeroContent } from '@aero-ssg/content/vite'
import type { UserConfig } from 'vite'
import type { AeroConfig, AeroConfigFunction } from './types'
import { defaultViteConfig } from './defaults'

/** Environment passed to createViteConfig (command and mode). */
export interface CreateViteConfigOptions {
	command: 'dev' | 'build'
	mode: 'development' | 'production'
}

/**
 * Create the Vite UserConfig from Aero config and env.
 *
 * @param aeroConfig - Static config or function receiving `{ command, mode }`.
 * @param options - Current command and mode (e.g. from CLI).
 * @returns Merged Vite config (defaults + Aero plugins + user vite; minify/cssMinify preserved when user overrides).
 */
export function createViteConfig(
	aeroConfig: AeroConfig | AeroConfigFunction,
	options: CreateViteConfigOptions,
): UserConfig {
	const resolvedConfig =
		typeof aeroConfig === 'function'
			? aeroConfig({ command: options.command, mode: options.mode })
			: aeroConfig

	const { content, server, site, dirs, vite: userViteConfig } = resolvedConfig

	const basePlugins: UserConfig['plugins'] = [
		aero({
			nitro: server ?? false,
			site,
			dirs,
		}),
	]

	if (content === true) {
		const contentOptions = typeof content === 'object' ? content : {}
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
