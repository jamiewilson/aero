/**
 * @aero-js/content — public API.
 *
 * @remarks
 * Exports collection types and helpers (`defineCollection`, `defineConfig`), `loadAllCollections` / config loading for tooling, and `render` for lazy markdown-to-HTML in pages.
 * The Vite plugin (`aeroContent`) is imported from `@aero-js/content/vite`.
 */
export { defineCollection, defineConfig } from './types'
export type {
	ContentCollectionConfig,
	ContentConfig,
	ContentDocument,
	ContentMeta,
	ContentSchemaIssue,
	MarkdownConfig,
} from './types'
export {
	ContentSchemaAggregateError,
	contentSchemaAggregateError,
	formatContentSchemaIssuesReport,
} from './content-issues'
export { contentSchemaIssuesToAeroDiagnostics } from './diagnostics-bridge'
export { loadAllCollections } from './loader'
export { render } from './render'
export { loadContentConfigFileSync, type LoadContentConfigResult } from './load-content-config'
