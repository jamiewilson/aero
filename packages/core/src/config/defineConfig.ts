/**
 * Typed helper for aero.config.ts: provides type inference and IDE support for the config object or function.
 */
import type { AeroOptionsInput } from '../types'

/**
 * Define the Aero config (object or function). Pass-through; used for typing and editor support.
 *
 * @param config - Static `AeroOptions` or env-aware function receiving `{ command, mode }`.
 * @returns The same config (unchanged).
 */
export function defineConfig(config: AeroOptionsInput): AeroOptionsInput {
	return config
}
