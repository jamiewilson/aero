/**
 * Aero config package: typed config shape, defineConfig helper, and Vite config factory.
 *
 * @remarks
 * Re-exports `defineConfig`, `createViteConfig`, and config types for use in `aero.config.ts` and the CLI/build entry.
 */
export { defineConfig } from './defineConfig'
export { createViteConfig } from './createViteConfig'
export type { AeroConfig, AeroConfigFunction, AeroUserConfig } from './types'
