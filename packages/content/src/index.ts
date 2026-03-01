/**
 * @aerobuilt/content — public API.
 *
 * @remarks
 * Exports collection types and helpers (`defineCollection`, `defineConfig`), and `render` for lazy markdown-to-HTML in pages.
 * The Vite plugin (`aeroContent`) is imported from `@aerobuilt/content/vite`.
 */
export { defineCollection, defineConfig } from './types'
export type {
	ContentCollectionConfig,
	ContentConfig,
	ContentDocument,
	ContentMeta,
} from './types'
export type { ShikiConfig } from '@aerobuilt/highlight'
export { render } from './render'
