/**
 * Effect entry for loading `aero.config` — mirrors {@link loadAeroConfig} for pipelines that compose with Effect.
 */
import { Effect } from 'effect'
import { loadAeroConfig } from './loadAeroConfig'
import type { AeroConfig, AeroConfigFunction } from './types'

/**
 * Same as {@link loadAeroConfig} wrapped in `Effect.sync` for composition with Layers and tests.
 */
export function loadAeroConfigEffect(root: string): Effect.Effect<AeroConfig | AeroConfigFunction | null, never, never> {
	return Effect.sync(() => loadAeroConfig(root))
}
