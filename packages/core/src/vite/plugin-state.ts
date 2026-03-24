/**
 * Helpers for Aero Vite plugin state after resolution (explicit errors instead of non-null assertions).
 */

import type { ResolvedConfig } from 'vite'
import type { AliasResult } from '../types'

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
