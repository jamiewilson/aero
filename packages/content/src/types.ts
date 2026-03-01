/**
 * Content package types: document metadata, collection config, and define helpers.
 *
 * @remarks
 * Used by the loader (frontmatter + body → ContentDocument), by content.config.ts (defineCollection, defineConfig), and by the Vite plugin.
 */
import type { ZodType } from 'zod'

/** Metadata attached to every content document (path, slug, filename, extension). */
export interface ContentMeta {
	/** Path relative to the collection directory (no extension). */
	path: string
	/** Slug derived from the filename (no extension). */
	slug: string
	/** The raw filename including extension. */
	filename: string
	/** The file extension (e.g. `'.md'`). */
	extension: string
}

/** A content document: id, validated frontmatter (`data`), raw body, and `_meta`. */
export interface ContentDocument<TSchema extends Record<string, any> = Record<string, any>> {
	/** Unique identifier: collection-relative path without extension. */
	id: string
	/** Validated frontmatter fields. */
	data: TSchema
	/** Raw body content (everything after frontmatter). */
	body: string
	/** Auto-generated metadata. */
	_meta: ContentMeta
}

/** Single collection definition: name, directory, glob, optional schema and transform. */
export interface ContentCollectionConfig<
	TSchema extends Record<string, any> = Record<string, any>,
	TOutput = ContentDocument<TSchema>,
> {
	/** Unique collection name (used as the export key, e.g. `allDocs`). */
	name: string
	/** Directory to scan, relative to project root. */
	directory: string
	/** Glob pattern for files to include (default: `**\/*.md`). */
	include?: string
	/** Zod schema for frontmatter validation; `body` is always present. */
	schema?: ZodType<TSchema>
	/** Optional async transform after validation; receives document, returns final shape. */
	transform?: (document: ContentDocument<TSchema>) => TOutput | Promise<TOutput>
}

/** Top-level content config: array of collection definitions with optional highlighting. */
export interface ContentConfig {
	collections: ContentCollectionConfig<any, any>[]
	/**
	 * Optional syntax highlighting configuration for markdown code blocks.
	 * Nest under `highlight.shiki` to use Shiki-powered highlighting.
	 * When omitted, plain `<pre><code>` output is produced (backward compatible).
	 *
	 * @see https://shiki.style/guide
	 */
	highlight?: {
		/** Shiki configuration. Uses Shiki's native `theme`/`themes` options. */
		shiki: import('@aerobuilt/highlight').ShikiConfig
	}
}

/**
 * Define a content collection (typed helper for content.config.ts).
 *
 * @param config - Collection config (name, directory, include, schema, transform).
 * @returns The same config (unchanged).
 */
export function defineCollection<
	TSchema extends Record<string, any> = Record<string, any>,
	TOutput = ContentDocument<TSchema>,
>(
	config: ContentCollectionConfig<TSchema, TOutput>,
): ContentCollectionConfig<TSchema, TOutput> {
	return config
}

/**
 * Define the content config (typed helper for content.config.ts).
 *
 * @param config - Config with `collections` array.
 * @returns The same config (unchanged).
 */
export function defineConfig(config: ContentConfig): ContentConfig {
	return config
}
