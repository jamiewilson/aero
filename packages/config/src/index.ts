/**
 * Aero config package: typed config shape, `defineConfig`, and `loadAeroConfig`.
 *
 * @remarks
 * **Vite:** import `createViteConfig` / `getDefaultOptions` from **`@aero-js/config/vite`**
 * in `vite.config.ts` so `aero.config.ts` can stay limited to this entry (jiti-safe, no Vite load).
 */
export { defineConfig } from './defineConfig'
export { loadAeroConfig } from './loadAeroConfig'
export {
	AeroConfigLoadError,
	configLoadErrorToDiagnostics,
	loadAeroConfigEffect,
	loadAeroConfigStrictEffect,
	loadResolvedAeroConfigEffect,
	resolveAeroConfigEffect,
} from './load-aero-config-effect'
export { redirectsToRouteRules } from './redirects'
export type { AeroConfig, AeroConfigFunction, AeroUserConfig } from './types'
