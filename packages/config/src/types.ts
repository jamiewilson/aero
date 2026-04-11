/**
 * Aero config types: user config shape, env-aware function, and resolved config with env.
 *
 * @remarks
 * Used by `aero.config.ts` and by `createViteConfig` to build the final Vite config.
 * dirs shape matches the Vite plugin (aero()) so the same options work in aero.config and vite.config.
 */
import type { UserConfig } from 'vite'
import type { AeroContentOptions } from '@aero-js/content/vite'
import type { AeroDirs, AeroOptions, RedirectRule } from '@aero-js/core/types'

/** User-facing Aero configuration (content, server, dirs, redirects, middleware, optional Vite overrides). */
export interface AeroConfig {
	/** Enable content collections (default: `false`). Pass `true` or `AeroContentOptions`. */
	content?: boolean | AeroContentOptions

	/** Enable Nitro server integration (default: `false`). */
	server?: boolean

	/**
	 * Canonical site URL (e.g. `'https://example.com'`). Exposed as `import.meta.env.SITE` and
	 * `Aero.site.url` in templates; used for sitemap, RSS, and canonical links.
	 */
	site?: { url: string }

	/** Directory overrides. Same shape as aero() plugin options. */
	dirs?: Partial<AeroDirs>

	/**
	 * Redirect rules applied in dev and when using the Nitro server (preview:api / production).
	 * For static-only deploys use host redirect config (_redirects, vercel.json, etc.).
	 */
	redirects?: RedirectRule[]

	/**
	 * Request-time middleware (rewrites, custom responses). Runs in dev only.
	 * For redirects use `redirects` so they apply in dev and server.
	 */
	middleware?: NonNullable<AeroOptions['middleware']>

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
