/**
 * Helpers for Aero Vite plugin state after resolution (explicit errors instead of non-null assertions).
 */

import type { ResolvedConfig } from 'vite'
import type { AeroOptions, AliasResult, ScriptEntry } from '../types'
import type { TemplateDiscovery } from './rollup-input-discovery'
import type { resolveDirs } from './defaults'

/** Shared state used by the Aero sub-plugins (config, virtuals, transform, ssr). */
export interface AeroPluginState {
	config: ResolvedConfig | null
	aliasResult: AliasResult | null
	clientScripts: Map<string, ScriptEntry>
	/** Single template walk + source cache: shared by Rollup `createBuildConfig` inputs and dev `buildStart` client scripts. */
	templateDiscovery: TemplateDiscovery | null
	runtimeInstancePath: string
	/** Set in configResolved: path to .aero/runtime-instance.mjs so Vite treats it as a real module (glob rules). */
	generatedRuntimeInstancePath: string | null
	/** Set in configResolved: path to `.aero/state-bindings-registry.mjs` for production reactive mounts. */
	generatedStateBindingsRegistryPath: string | null
	dirs: ReturnType<typeof resolveDirs>
	apiPrefix: string
	options: AeroOptions
	/** Dedupes compile warnings when unchanged templates are recompiled during dev HMR. */
	compileWarningHashes: Map<string, string>
	/** Set when Vite `buildEnd` receives an error so static prerender does not run after a failed bundle. */
	staticBuildFailed: boolean
}

/** @throws If `configResolved` has not run (should not happen for build hooks). */
export function requireResolvedConfig(state: { config: ResolvedConfig | null }): ResolvedConfig {
	if (!state.config) {
		throw new Error(
			'[aero] Internal error: Vite resolved config is not available (configResolved did not run).'
		)
	}
	return state.config
}

/** @throws If the `config` hook has not merged aliases (should not happen for compile/load hooks). */
export function requireAliasResult(state: { aliasResult: AliasResult | null }): AliasResult {
	if (!state.aliasResult) {
		throw new Error(
			'[aero] Internal error: path aliases are not available (config hook did not run).'
		)
	}
	return state.aliasResult
}
