/**
 * Typed helper for aero.config.ts: provides type inference and IDE support for the config object or function.
 */
import type { AeroUserConfig } from './types'

/**
 * Define the Aero config (object or function). Pass-through; used for typing and editor support.
 *
 * @param config - Static `AeroConfig` or `AeroConfigFunction` receiving `{ command, mode }`.
 * @returns The same config (unchanged).
 */
export function defineConfig(config: AeroUserConfig): AeroUserConfig {
	return config
}
