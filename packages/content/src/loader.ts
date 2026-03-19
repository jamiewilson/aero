/**
 * Content loader: discover files, parse frontmatter (gray-matter), validate with Standard Schema, run transforms, and serialize to virtual module source.
 *
 * @remarks
 * Used by the Vite plugin to load all collections and emit the `aero:content` virtual module (getCollection + serialized data).
 */
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

/** Load one collection: glob files in directory, parse frontmatter, validate schema, apply transform. */
async function loadCollection<TSchema extends Record<string, any>, TOutput>(
	config: ContentCollectionConfig<TSchema, TOutput>,
	root: string
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

		// Schema validation (Standard Schema)
		let validated = frontmatter as TSchema
		if (config.schema) {
			const std = config.schema['~standard']
			if (!std?.validate) {
				throw new Error(
					`[aero:content] Schema must implement Standard Schema (e.g. Zod, ArkType, Valibot). See https://standardschema.dev`
				)
			}
			const rawResult = std.validate(frontmatter)
			const result = rawResult instanceof Promise ? await rawResult : rawResult
			if (result.issues) {
				const errors = result.issues.map((i) => i.message).join(', ')
				console.warn(
					`[aero:content] ⚠ Skipping "${relPath}" in collection "${config.name}": ${errors}`
				)
				continue
			}
			validated = result.value as TSchema
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

const CONTENT_ROOT = 'content'

/**
 * Load a single markdown file as a ContentDocument. Works for files under `content/` regardless of collection membership.
 *
 * @param filePath - Absolute path to the .md file (or path resolvable relative to root).
 * @param config - ContentConfig or null. When present, matches file to a collection for schema/transform; otherwise frontmatter passes through.
 * @param root - Project root.
 * @returns ContentDocument.
 */
export async function loadSingleFile(
	filePath: string,
	config: ContentConfig | null,
	root: string
): Promise<ContentDocument> {
	const absolutePath = path.isAbsolute(filePath)
		? filePath
		: path.resolve(root, filePath)
	const contentDir = path.resolve(root, CONTENT_ROOT)
	const relToContent = path.relative(contentDir, absolutePath)

	if (relToContent.startsWith('..') || path.isAbsolute(relToContent)) {
		throw new Error(
			`[aero:content] File "${absolutePath}" is not under content directory "${contentDir}". Single-file imports must be under content/.`
		)
	}

	const raw = fs.readFileSync(absolutePath, 'utf-8')
	const { data: frontmatter, content: body } = matter(raw)

	const relPath = path.relative(contentDir, absolutePath)
	const parsed = path.parse(relPath)
	const id = parsed.dir ? `${parsed.dir}/${parsed.name}` : parsed.name
	const meta: ContentMeta = {
		path: id,
		slug: parsed.name,
		filename: parsed.base,
		extension: parsed.ext,
	}

	let validated = frontmatter as Record<string, any>

	if (config?.collections?.length) {
		for (const collection of config.collections) {
			const dir = path.resolve(root, collection.directory)
			const pattern = collection.include || '**/*.md'
			const files = await fg(pattern, { cwd: dir, absolute: true })
			if (!files.includes(absolutePath)) continue

			if (collection.schema) {
				const std = collection.schema['~standard']
				if (!std?.validate) {
					throw new Error(
						`[aero:content] Schema must implement Standard Schema. See https://standardschema.dev`
					)
				}
				const rawResult = std.validate(frontmatter)
				const result = rawResult instanceof Promise ? await rawResult : rawResult
				if (result.issues) {
					const errors = result.issues.map((i: { message: string }) => i.message).join(', ')
					throw new Error(
						`[aero:content] Schema validation failed for "${relPath}": ${errors}`
					)
				}
				validated = result.value as Record<string, any>
			}

			const doc: ContentDocument = { id, data: validated, body, _meta: meta }
			if (collection.transform) {
				return (await collection.transform(doc)) as ContentDocument
			}
			return doc
		}
	}

	return { id, data: validated, body, _meta: meta }
}

/**
 * Load all collections; returns a map from collection name to document array.
 *
 * @param config - ContentConfig (collections array).
 * @param root - Project root.
 * @returns Map<collectionName, documents[]>.
 */
export async function loadAllCollections(
	config: ContentConfig,
	root: string
): Promise<LoadedContent> {
	const result: LoadedContent = new Map()
	const collections = config.collections ?? []

	for (const collection of collections) {
		const docs = await loadCollection(collection, root)
		result.set(collection.name, docs)
	}

	return result
}

/** Absolute paths of all collection directories (for HMR watch and invalidation). */
export function getWatchedDirs(config: ContentConfig, root: string): string[] {
	return (config.collections ?? []).map(c => path.resolve(root, c.directory))
}

/** Absolute path of the content root (for HMR when no config or for single-file imports). */
export function getContentRoot(root: string): string {
	return path.resolve(root, CONTENT_ROOT)
}

/** Collection name to camelCase export name (e.g. `docs` → `allDocs`, `blog-posts` → `allBlogPosts`). */
export function toExportName(collectionName: string): string {
	const camel = collectionName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
	return `all${camel.charAt(0).toUpperCase()}${camel.slice(1)}`
}

/**
 * Serialize loaded collections into ESM source: `__collections` object, `getCollection(name, filterFn)`, and re-export of `render`.
 *
 * @param loaded - Map of collection name → document array (from loadAllCollections).
 * @returns Full module source string for the virtual module.
 */
export function serializeContentModule(loaded: LoadedContent): string {
	const collectionsContent = Array.from(loaded.entries())
		.map(
			([name, docs]) =>
				`  ${JSON.stringify(name)}: ${JSON.stringify(docs, null, 2)}`
		)
		.join(',\n')

	return `
const __collections = {
${collectionsContent}
};

export function getCollection(name, filterFn) {
  let data = __collections[name];
  if (!data) throw new Error(\`[aero:content] Collection "\${name}" not found. Available: \${Object.keys(__collections).join(", ")}\`);

  if (import.meta.env.PROD) {
    data = data.filter(item => item.data.published === true);
  }

  if (typeof filterFn === "function") {
    return data.filter(filterFn);
  }

  return data;
}

export { render } from '@aero-js/content/render';
`
}
