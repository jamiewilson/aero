/**
 * Vite integration: `createViteConfig` pulls in Vite and `@aero-js/vite`.
 * Import from `@aero-js/config/vite` in **`vite.config.ts`** only — not from `aero.config.ts`
 * (jiti loads the latter in a context where Vite’s `import.meta` breaks).
 */
export { createViteConfig, getDefaultOptions } from './createViteConfig'
export type { CreateViteConfigOptions } from './createViteConfig'
