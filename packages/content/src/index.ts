/**
 * @aero-ssg/content — public API.
 *
 * @remarks
 * Exports collection types and helpers (`defineCollection`, `defineConfig`), and `render` for lazy markdown-to-HTML in pages.
 * The Vite plugin (`aeroContent`) is imported from `@aero-ssg/content/vite`.
 */
export { defineCollection, defineConfig } from './types'
export type {
	ContentCollectionConfig,
	ContentConfig,
	ContentDocument,
	ContentMeta,
} from './types'
export { render } from './render'
