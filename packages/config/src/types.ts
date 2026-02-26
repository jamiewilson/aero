/**
 * Aero config types: user config shape, env-aware function, and resolved config with env.
 *
 * @remarks
 * Used by `aero.config.ts` and by `createViteConfig` to build the final Vite config.
 */
import type { UserConfig } from 'vite'
import type { AeroContentOptions } from '@aerobuilt/content/vite'
import type { AeroMiddleware, RedirectRule } from '@aerobuilt/core/types'

/** User-facing Aero configuration (content, server, dirs, redirects, middleware, optional Vite overrides). */
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

	/**
	 * Redirect rules applied in dev and when using the Nitro server (preview:api / production).
	 * For static-only deploys use host redirect config (_redirects, vercel.json, etc.).
	 */
	redirects?: RedirectRule[]

	/**
	 * Request-time middleware (rewrites, custom responses). Runs in dev only.
	 * For redirects use `redirects` so they apply in dev and server.
	 */
	middleware?: AeroMiddleware[]

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
