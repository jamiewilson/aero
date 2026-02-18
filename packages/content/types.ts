import type { ZodType } from 'zod'

// ─── Document Metadata ──────────────────────────────────────────────

/** Metadata automatically attached to every content document. */
export interface ContentMeta {
	/** Path relative to the collection directory (no extension). */
	path: string
	/** Slug derived from the filename (no extension). */
	slug: string
	/** The raw filename including extension. */
	filename: string
	/** The file extension (e.g. '.md'). */
	extension: string
}

/** A raw content document before user transforms. */
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

// ─── Collection Configuration ───────────────────────────────────────

export interface ContentCollectionConfig<
	TSchema extends Record<string, any> = Record<string, any>,
	TOutput = ContentDocument<TSchema>,
> {
	/** Unique collection name (used as the export key, e.g. `allDocs`). */
	name: string
	/** Directory to scan, relative to project root. */
	directory: string
	/** Glob pattern for files to include (default: `'**\/*.md'`). */
	include?: string
	/**
	 * Zod schema for frontmatter validation.
	 * When provided, each document's frontmatter is parsed and validated.
	 * The `body` field (raw body) is always available regardless of schema.
	 */
	schema?: ZodType<TSchema>
	/**
	 * Optional async transform applied after schema validation.
	 * Receives the full document and should return the final shape.
	 */
	transform?: (document: ContentDocument<TSchema>) => TOutput | Promise<TOutput>
}

export interface ContentConfig {
	/** Array of collection definitions. */
	collections: ContentCollectionConfig<any, any>[]
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Define a content collection.
 *
 * ```ts
 * const docs = defineCollection({
 *   name: 'docs',
 *   directory: 'client/content/docs',
 *   include: '**\/*.md',
 *   schema: z.object({ title: z.string() }),
 * })
 * ```
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
 * Define the content configuration with one or more collections.
 *
 * ```ts
 * export default defineConfig({
 *   collections: [docs, posts],
 * })
 * ```
 */
export function defineConfig(config: ContentConfig): ContentConfig {
	return config
}
