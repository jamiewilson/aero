/// <reference types="vite/client" />

/**
 * Extend Vite's ImportMetaEnv with Aero-injected and project env vars.
 * - SITE: set by Aero when `site` is configured in aero.config.ts
 * - Add VITE_* vars here for TypeScript/IDE support when you use them in .env
 */
interface ImportMetaEnv {
	readonly SITE: string
	// Example: readonly VITE_PUBLIC_API: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
