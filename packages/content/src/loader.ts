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
	ContentSchemaIssue,
} from './types'
import { contentSchemaAggregateError } from './content-issues'
import fg from 'fast-glob'
import matter from 'gray-matter'
import fs from 'node:fs'
import path from 'node:path'
import { Cause, Effect, Exit, Option } from 'effect'

/** Load one collection: glob files in directory, parse frontmatter, validate schema, apply transform. */
async function loadCollectionAsync<TSchema extends Record<string, any>, TOutput>(
	config: ContentCollectionConfig<TSchema, TOutput>,
	root: string
): Promise<{ documents: TOutput[]; schemaIssues: ContentSchemaIssue[] }> {
	const dir = path.resolve(root, config.directory)
	const pattern = config.include || '**/*.md'
	const files = await fg(pattern, { cwd: dir, absolute: true })

	const documents: TOutput[] = []
	const schemaIssues: ContentSchemaIssue[] = []

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
				schemaIssues.push({
					collection: config.name,
					relPath,
					file,
					messages: result.issues.map(i => i.message),
				})
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

	return { documents, schemaIssues }
}

/**
 * Effect program for one collection (maps to {@link loadCollectionAsync}).
 * Composed by {@link loadAllCollectionsEffect}; keeps a single Node boundary for tests and future services.
 */
export function loadCollectionEffect<TSchema extends Record<string, any>, TOutput>(
	config: ContentCollectionConfig<TSchema, TOutput>,
	root: string
): Effect.Effect<{ documents: TOutput[]; schemaIssues: ContentSchemaIssue[] }, Error, never> {
	return Effect.tryPromise({
		try: () => loadCollectionAsync(config, root),
		catch: e => (e instanceof Error ? e : new Error(String(e))),
	})
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
	const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath)
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
					throw new Error(`[aero:content] Schema validation failed for "${relPath}": ${errors}`)
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
 * Load all collections; returns a map from collection name to document array plus any schema issues.
 *
 * @param config - ContentConfig (collections array).
 * @param root - Project root.
 * @returns Loaded collections and schema issues for invalid files (skipped unless `strictSchema` or `AERO_CONTENT_STRICT`).
 */
function isStrictSchemaEnabled(config: ContentConfig): boolean {
	return config.strictSchema === true || process.env.AERO_CONTENT_STRICT === '1'
}

/**
 * Effect program for loading all collections; {@link loadAllCollections} runs this with `Effect.runPromise`.
 */
export function loadAllCollectionsEffect(
	config: ContentConfig,
	root: string
): Effect.Effect<{ loaded: LoadedContent; schemaIssues: ContentSchemaIssue[] }, Error, never> {
	const collections = config.collections ?? []
	return Effect.forEach(collections, collection => loadCollectionEffect(collection, root)).pipe(
		Effect.map(results => {
			const loaded: LoadedContent = new Map()
			const schemaIssues: ContentSchemaIssue[] = []
			for (let i = 0; i < collections.length; i++) {
				const collection = collections[i]!
				const result = results[i]!
				loaded.set(collection.name, result.documents)
				schemaIssues.push(...result.schemaIssues)
			}
			return { loaded, schemaIssues }
		}),
		Effect.flatMap(({ loaded, schemaIssues }) => {
			if (isStrictSchemaEnabled(config) && schemaIssues.length > 0) {
				return Effect.fail(contentSchemaAggregateError(schemaIssues))
			}
			return Effect.succeed({ loaded, schemaIssues })
		})
	)
}

/**
 * Load all collections. Uses the same logic as {@link loadAllCollectionsEffect} without `Effect.runPromise`
 * so strict-mode {@link ContentSchemaAggregateError} propagates to callers unchanged.
 */
export async function loadAllCollections(
	config: ContentConfig,
	root: string
): Promise<{ loaded: LoadedContent; schemaIssues: ContentSchemaIssue[] }> {
	const exit = await Effect.runPromiseExit(loadAllCollectionsEffect(config, root))
	return Exit.match(exit, {
		onSuccess: value => value,
		onFailure: cause => {
			const failure = Cause.failureOption(cause)
			if (Option.isSome(failure)) {
				throw failure.value
			}
			throw new Error(Cause.pretty(cause))
		},
	})
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

/** Options for {@link serializeContentModule} (e.g. schema warnings for tooling / `aero check`). */
export interface SerializeContentModuleOptions {
	/** Non-strict loads: files that failed schema validation (embedded for static analysis). */
	schemaIssues?: readonly ContentSchemaIssue[]
}

/**
 * Serialize loaded collections into ESM source: `__collections` object, `getCollection(name, filterFn)`, and re-export of `render`.
 *
 * @param loaded - Map of collection name → document array (from loadAllCollections).
 * @param options - Optional `schemaIssues` exported as `__aeroContentSchemaIssues` (empty array when omitted).
 * @returns Full module source string for the virtual module.
 */
export function serializeContentModule(
	loaded: LoadedContent,
	options?: SerializeContentModuleOptions
): string {
	const collectionsContent = Array.from(loaded.entries())
		.map(([name, docs]) => `  ${JSON.stringify(name)}: ${JSON.stringify(docs, null, 2)}`)
		.join(',\n')

	const schemaIssues = options?.schemaIssues ?? []
	const issuesJson = JSON.stringify(schemaIssues)

	return `
export const __aeroContentSchemaIssues = ${issuesJson};

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
