import { mergeConfig } from 'vite'
import { aero } from '@aero-ssg/core/vite'
import { aeroContent } from '@aero-ssg/content/vite'
import type { UserConfig } from 'vite'
import type { AeroConfig, AeroConfigFunction } from './types'
import { defaultViteConfig } from './defaults'

export interface CreateViteConfigOptions {
	command: 'dev' | 'build'
	mode: 'development' | 'production'
}

export function createViteConfig(
	aeroConfig: AeroConfig | AeroConfigFunction,
	options: CreateViteConfigOptions,
): UserConfig {
	const resolvedConfig =
		typeof aeroConfig === 'function'
			? aeroConfig({ command: options.command, mode: options.mode })
			: aeroConfig

	const { content, server, dirs, vite: userViteConfig } = resolvedConfig

	const basePlugins: UserConfig['plugins'] = [
		aero({
			nitro: server ?? false,
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
