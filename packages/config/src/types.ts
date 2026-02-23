/**
 * Aero config types: user config shape, env-aware function, and resolved config with env.
 *
 * @remarks
 * Used by `aero.config.ts` and by `createViteConfig` to build the final Vite config.
 */
import type { UserConfig } from 'vite'
import type { AeroContentOptions } from '@aero-ssg/content/vite'

/** User-facing Aero configuration (content, server, dirs, optional Vite overrides). */
export interface AeroConfig {
	/** Enable content collections (default: `false`). Pass `true` or `AeroContentOptions`. */
	content?: boolean | AeroContentOptions

	/** Enable Nitro server integration (default: `false`). */
	server?: boolean

	/**
	 * Canonical site URL (e.g. `'https://example.com'`). Exposed as `import.meta.env.SITE` and
	 * `Aero.site` in templates; used for sitemap, RSS, and canonical links.
	 */
	site?: string

	/** Directory overrides. */
	dirs?: {
		/** Site source directory; pages live at `client/pages` (default: `'client'`). */
		client?: string
		/** Nitro server directory (default: `'server'`). */
		serverDir?: string
		/** Build output directory (default: `'dist'`). */
		dist?: string
	}

	/** Vite configuration merged with Aero defaults (plugins, build, etc.). */
	vite?: UserConfig
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
