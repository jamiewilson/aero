/**
 * Aero config package: typed config shape, `defineConfig`, and `loadAeroConfig`.
 *
 * @remarks
 * **Vite:** import `createViteConfig` / `getDefaultOptions` from **`@aero-js/core/vite-config`**
 * in `vite.config.ts` so `aero.config.ts` can stay limited to this entry (jiti-safe, no Vite load).
 */
export { defineConfig } from './defineConfig'
export { loadAeroConfig, CONFIG_NAMES } from './loadAeroConfig'
export { AeroConfigLoadError, configLoadErrorToDiagnostics } from './config-load-errors'
export type { AeroConfig, AeroConfigFunction, AeroUserConfig } from './types'
