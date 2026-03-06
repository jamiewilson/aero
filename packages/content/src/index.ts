/**
 * @aero-js/content — public API.
 *
 * @remarks
 * Exports collection types and helpers (`defineCollection`, `defineConfig`), and `render` for lazy markdown-to-HTML in pages.
 * The Vite plugin (`aeroContent`) is imported from `@aero-js/content/vite`.
 */
export { defineCollection, defineConfig } from './types'
export type {
	ContentCollectionConfig,
	ContentConfig,
	ContentDocument,
	ContentMeta,
	MarkdownConfig,
} from './types'
export { render } from './render'
