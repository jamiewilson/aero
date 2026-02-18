import type {
	ContentCollectionConfig,
	ContentConfig,
	ContentDocument,
	ContentMeta,
} from './types'
import fg from 'fast-glob'
import matter from 'gray-matter'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Load a single content collection: discover files, parse frontmatter,
 * validate schemas, and run transforms.
 */
async function loadCollection<TSchema extends Record<string, any>, TOutput>(
	config: ContentCollectionConfig<TSchema, TOutput>,
	root: string,
): Promise<TOutput[]> {
	const dir = path.resolve(root, config.directory)
	const pattern = config.include || '**/*.md'
	const files = await fg(pattern, { cwd: dir, absolute: true })

	const documents: TOutput[] = []

	for (const file of files) {
		const raw = fs.readFileSync(file, 'utf-8')
		const { data: frontmatter, content: body } = matter(raw)

		const relPath = path.relative(dir, file)
		const parsed = path.parse(relPath)
		const id = parsed.dir ? `${parsed.dir}/${parsed.name}` : parsed.name
		const meta: ContentMeta = {
			path: id,
			slug: parsed.name,
			filename: parsed.base,
			extension: parsed.ext,
		}

		// Schema validation (zod)
		let validated = frontmatter as TSchema
		if (config.schema) {
			const result = config.schema.safeParse(frontmatter)
			if (!result.success) {
				const errors =
					'error' in result ?
						(result as any).error?.issues?.map((i: any) => i.message).join(', ')
					:	'Validation failed'
				console.warn(
					`[aero:content] ⚠ Skipping "${relPath}" in collection "${config.name}": ${errors}`,
				)
				continue
			}
			validated = result.data as TSchema
		}

		const doc: ContentDocument<TSchema> = {
			id,
			data: validated,
			body,
			_meta: meta,
		}

		if (config.transform) {
			documents.push(await config.transform(doc))
		} else {
			documents.push(doc as unknown as TOutput)
		}
	}

	return documents
}

/** Loaded content keyed by collection name. */
export type LoadedContent = Map<string, any[]>

/**
 * Load all collections defined in a content config.
 * Returns a `Map<collectionName, documents[]>`.
 */
export async function loadAllCollections(
	config: ContentConfig,
	root: string,
): Promise<LoadedContent> {
	const result: LoadedContent = new Map()

	for (const collection of config.collections) {
		const docs = await loadCollection(collection, root)
		result.set(collection.name, docs)
	}

	return result
}

/**
 * Resolve the absolute directories watched for content changes.
 */
export function getWatchedDirs(config: ContentConfig, root: string): string[] {
	return config.collections.map(c => path.resolve(root, c.directory))
}

/**
 * Convert a collection name to its camelCase export name.
 * e.g. "docs" → "allDocs", "blog-posts" → "allBlogPosts"
 */
export function toExportName(collectionName: string): string {
	const camel = collectionName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
	return `all${camel.charAt(0).toUpperCase()}${camel.slice(1)}`
}

/**
 * Serialize loaded content into an ESM module string.
 *
 * Produces:
 * ```js
 * const __collections = { docs: [...], posts: [...] };
 * export function getCollection(name) { ... }
 * export { render } from '@aero-ssg/content/render';
 * ```
 */
export function serializeContentModule(loaded: LoadedContent): string {
	const lines: string[] = []

	// Build the collections map
	lines.push('const __collections = {')
	for (const [name, docs] of loaded) {
		lines.push(`  ${JSON.stringify(name)}: ${JSON.stringify(docs, null, 2)},`)
	}
	lines.push('};')
	lines.push('')

	// getCollection function
	lines.push('export function getCollection(name) {')
	lines.push('  const data = __collections[name];')
	lines.push(
		'  if (!data) throw new Error(`[aero:content] Collection "${name}" not found. Available: ${Object.keys(__collections).join(", ")}`);',
	)
	lines.push('  return data;')
	lines.push('}')
	lines.push('')

	// Re-export render
	lines.push("export { render } from '@aero-ssg/content/render';")

	return lines.join('\n')
}
