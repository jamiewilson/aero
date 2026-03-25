/**
 * Effect entry for loading `aero.config` — mirrors {@link loadAeroConfig} for pipelines that compose with Effect.
 */
import { Effect } from 'effect'
import type { AeroDiagnostic } from '@aero-js/core/diagnostics'
import { unknownToAeroDiagnostics } from '@aero-js/core/diagnostics'
import { loadAeroConfig, loadAeroConfigDetailed } from './loadAeroConfig'
import type { AeroConfig, AeroConfigFunction } from './types'

export interface ResolveAeroConfigEffectOptions {
	applyEnvPolicy?: boolean
	env?: NodeJS.ProcessEnv
}

export class AeroConfigLoadError extends Error {
	readonly filePath: string
	readonly causeUnknown: unknown
	constructor(message: string, filePath: string, causeUnknown: unknown) {
		super(message)
		this.name = 'AeroConfigLoadError'
		this.filePath = filePath
		this.causeUnknown = causeUnknown
	}
}

function parseOptionalBoolean(raw: string | undefined): boolean | undefined {
	if (raw === undefined) return undefined
	const v = raw.trim().toLowerCase()
	if (v === '1' || v === 'true') return true
	if (v === '0' || v === 'false') return false
	return undefined
}

function applyEnvPolicy(config: AeroConfig, env: NodeJS.ProcessEnv): AeroConfig {
	const next: AeroConfig = { ...config }
	const server = parseOptionalBoolean(env.AERO_SERVER)
	const content = parseOptionalBoolean(env.AERO_CONTENT)
	const siteUrl = env.AERO_SITE_URL?.trim()
	const dirClient = env.AERO_DIR_CLIENT?.trim()
	const dirServer = env.AERO_DIR_SERVER?.trim()
	const dirDist = env.AERO_DIR_DIST?.trim()

	if (server !== undefined) {
		next.server = server
	}
	if (content !== undefined) {
		next.content = content
	}
	if (siteUrl) {
		next.site = { url: siteUrl }
	}
	if (dirClient || dirServer || dirDist) {
		next.dirs = {
			...(next.dirs ?? {}),
			...(dirClient ? { client: dirClient } : {}),
			...(dirServer ? { server: dirServer } : {}),
			...(dirDist ? { dist: dirDist } : {}),
		}
	}
	return next
}

/**
 * Same as {@link loadAeroConfig} wrapped in `Effect.sync` for composition with Layers and tests.
 */
export function loadAeroConfigEffect(
	root: string
): Effect.Effect<AeroConfig | AeroConfigFunction | null, Error, never> {
	return Effect.try({
		try: () => loadAeroConfig(root),
		catch: e => (e instanceof Error ? e : new Error(String(e))),
	})
}

/**
 * Strict variant: returns null when missing; fails when config file exists but cannot load
 * or exports an invalid value.
 */
export function loadAeroConfigStrictEffect(
	root: string
): Effect.Effect<AeroConfig | AeroConfigFunction | null, AeroConfigLoadError, never> {
	return Effect.try({
		try: () => {
			const detailed = loadAeroConfigDetailed(root)
			if (detailed.ok) return detailed.config
			if (detailed.reason === 'not-found') return null
			if (detailed.reason === 'invalid-export') {
				throw new AeroConfigLoadError(
					'[aero] aero.config must export an object or function.',
					detailed.filePath,
					new Error('Invalid aero.config export')
				)
			}
			throw new AeroConfigLoadError(
				'[aero] Failed to load aero.config via jiti.',
				detailed.filePath,
				detailed.error
			)
		},
		catch: e =>
			e instanceof AeroConfigLoadError
				? e
				: new AeroConfigLoadError(
						'[aero] Failed to load aero.config via jiti.',
						root,
						e instanceof Error ? e : new Error(String(e))
					),
	})
}

/**
 * Resolve a loaded Aero config (object/function/null) into a concrete object for a specific env.
 */
export function resolveAeroConfigEffect(
	loaded: AeroConfig | AeroConfigFunction | null,
	env: { command: 'dev' | 'build'; mode: 'development' | 'production' },
	options: ResolveAeroConfigEffectOptions = {}
): Effect.Effect<AeroConfig, Error, never> {
	return Effect.try({
		try: () => {
			const base = loaded === null ? {} : typeof loaded === 'function' ? loaded(env) : loaded
			if (base === null || typeof base !== 'object' || Array.isArray(base)) {
				throw new Error('[aero] aero.config must export an object or function returning an object.')
			}
			if (!options.applyEnvPolicy) {
				return base
			}
			return applyEnvPolicy(base, options.env ?? process.env)
		},
		catch: e => (e instanceof Error ? e : new Error(String(e))),
	})
}

/**
 * Load and resolve Aero config in one Effect pipeline.
 */
export function loadResolvedAeroConfigEffect(
	root: string,
	env: { command: 'dev' | 'build'; mode: 'development' | 'production' },
	options: ResolveAeroConfigEffectOptions = {}
): Effect.Effect<AeroConfig, Error, never> {
	return Effect.flatMap(loadAeroConfigEffect(root), loaded =>
		resolveAeroConfigEffect(loaded, env, options)
	)
}

/**
 * Map strict config-load errors to canonical diagnostics category/codes.
 */
export function configLoadErrorToDiagnostics(err: unknown): AeroDiagnostic[] {
	if (err instanceof AeroConfigLoadError) {
		return unknownToAeroDiagnostics(err.causeUnknown, {
			code: 'AERO_CONFIG',
			file: err.filePath,
		}).map(d => ({
			...d,
			file: err.filePath,
			span: d.span ? { ...d.span, file: err.filePath } : d.span,
		}))
	}
	return unknownToAeroDiagnostics(err, { code: 'AERO_CONFIG' })
}
