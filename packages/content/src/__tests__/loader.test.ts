/**
 * Tests for the content loader: collection discovery, frontmatter parsing,
 * schema validation, transforms, and virtual module serialization.
 */
import { describe, it, expect } from 'vitest'
import {
	loadAllCollections,
	getWatchedDirs,
	getContentRoot,
	toExportName,
	serializeContentModule,
	loadSingleFile,
} from '../loader'
import { ContentSchemaAggregateError } from '../content-issues'
import { defineCollection, defineConfig } from '../types'
import { z } from 'zod'
import path from 'node:path'

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures')
const PROJECT_ROOT = path.resolve(FIXTURES_DIR, 'project-root')

const docsCollection = defineCollection({
	name: 'docs',
	directory: path.resolve(FIXTURES_DIR, 'docs'),
	include: '**/*.md',
	schema: z.object({
		title: z.string(),
		subtitle: z.string().optional(),
		date: z.date(),
	}),
})

describe('loadAllCollections', () => {
	it('discovers and loads all markdown files in the collection directory', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!

		expect(docs).toBeDefined()
		expect(docs.length).toBe(3)
	})

	it('parses frontmatter (gray-matter) and applies Standard Schema (Zod)', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d._meta.slug === 'hello')

		expect(hello).toBeDefined()
		expect(hello.data.title).toBe('Test Post')
		expect(hello.data.subtitle).toBe('A test subtitle')
		expect(hello.data.date).toBeInstanceOf(Date)
	})

	it('sets id from collection-relative path (dir/name for nested files)', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!

		const hello = docs.find((d: any) => d.id === 'hello')
		expect(hello).toBeDefined()
		expect(hello.id).toBe('hello')

		const nested = docs.find((d: any) => d.id === 'guides/nested')
		expect(nested).toBeDefined()
		expect(nested.id).toBe('guides/nested')
	})

	it('generates _meta (path, slug, filename, extension) for root-level files', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d.id === 'hello')

		expect(hello._meta.path).toBe('hello')
		expect(hello._meta.slug).toBe('hello')
		expect(hello._meta.filename).toBe('hello.md')
		expect(hello._meta.extension).toBe('.md')
	})

	it('generates _meta for nested files (slug is basename only)', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const nested = docs.find((d: any) => d.id === 'guides/nested')

		expect(nested).toBeDefined()
		expect(nested._meta.path).toBe('guides/nested')
		expect(nested._meta.slug).toBe('nested')
		expect(nested._meta.filename).toBe('nested.md')
	})

	it('includes raw markdown (post-frontmatter) as body', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d.id === 'hello')

		expect(hello.body).toContain('# Hello World')
		expect(hello.body).toContain('**test**')
	})

	it('allows optional schema fields to be omitted in frontmatter', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const second = docs.find((d: any) => d.id === 'second')

		expect(second).toBeDefined()
		expect(second.data.title).toBe('Second Post')
		expect(second.data.subtitle).toBeUndefined()
	})

	it('skips files that fail schema validation and returns every issue (no throw)', async () => {
		const invalidCollection = defineCollection({
			name: 'invalid',
			directory: path.resolve(FIXTURES_DIR, 'invalid'),
			include: '**/*.md',
			schema: z.object({ title: z.string() }),
		})

		const config = defineConfig({ collections: [invalidCollection] })
		const { loaded, schemaIssues } = await loadAllCollections(config, '/')
		const docs = loaded.get('invalid')!

		expect(docs.length).toBe(0)
		expect(schemaIssues).toHaveLength(2)
		expect(schemaIssues.map(i => i.relPath).sort()).toEqual(['bad.md', 'bad2.md'])
		expect(schemaIssues.every(i => i.messages.length > 0)).toBe(true)
	})

	it('strictSchema throws ContentSchemaAggregateError listing all invalid files', async () => {
		const invalidCollection = defineCollection({
			name: 'invalid',
			directory: path.resolve(FIXTURES_DIR, 'invalid'),
			include: '**/*.md',
			schema: z.object({ title: z.string() }),
		})

		const config = defineConfig({
			collections: [invalidCollection],
			strictSchema: true,
		})
		try {
			await loadAllCollections(config, '/')
			expect.fail('expected strictSchema to throw')
		} catch (e) {
			expect(e).toBeInstanceOf(ContentSchemaAggregateError)
			const err = e as ContentSchemaAggregateError
			expect(err.issues).toHaveLength(2)
			expect(err.message).toContain('[AERO_CONTENT_SCHEMA]')
		}
	})

	it('parses frontmatter with ArkType schema (Standard Schema)', async () => {
		const { type } = await import('arktype')
		const arktypeCollection = defineCollection({
			name: 'arkdocs',
			directory: path.resolve(FIXTURES_DIR, 'docs'),
			include: '**/*.md',
			schema: type({
				title: 'string',
				'subtitle?': 'string',
				date: 'Date',
			}),
		})

		const config = defineConfig({ collections: [arktypeCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('arkdocs')!
		const hello = docs.find((d: any) => d._meta.slug === 'hello')

		expect(hello).toBeDefined()
		expect(hello.data.title).toBe('Test Post')
		expect(hello.data.subtitle).toBe('A test subtitle')
		expect(hello.data.date).toBeInstanceOf(Date)
	})

	it('throws when schema does not implement Standard Schema', async () => {
		const invalidSchemaCollection = defineCollection({
			name: 'bad',
			directory: path.resolve(FIXTURES_DIR, 'docs'),
			include: '**/*.md',
			schema: { foo: 'bar' } as any,
		})

		const config = defineConfig({ collections: [invalidSchemaCollection] })
		await expect(loadAllCollections(config, '/')).rejects.toThrow(
			/Schema must implement Standard Schema/
		)
	})

	it('loads without schema validation when no schema is provided', async () => {
		const noSchemaCollection = defineCollection({
			name: 'raw',
			directory: path.resolve(FIXTURES_DIR, 'docs'),
			include: '**/*.md',
		})

		const config = defineConfig({ collections: [noSchemaCollection] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('raw')!

		expect(docs.length).toBe(3)
		expect(docs[0].data).toBeDefined()
		expect(docs[0].id).toBeDefined()
		expect(docs[0].body).toBeDefined()
	})

	/**
	 * Transform runs after validation and replaces the document shape;
	 * the returned object is what gets stored (no _meta/body unless re-added).
	 */
	it('applies optional transform and uses its return value as the document', async () => {
		const transformed = defineCollection({
			name: 'docs',
			directory: path.resolve(FIXTURES_DIR, 'docs'),
			include: '**/*.md',
			schema: z.object({
				title: z.string(),
				subtitle: z.string().optional(),
				date: z.date(),
			}),
			transform: async doc => ({
				title: doc.data.title,
				slug: doc._meta.slug,
				id: doc.id,
				uppercaseTitle: doc.data.title.toUpperCase(),
			}),
		})

		const config = defineConfig({ collections: [transformed] })
		const { loaded } = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d.id === 'hello')

		expect(hello).toBeDefined()
		expect(hello.uppercaseTitle).toBe('TEST POST')
		expect(hello._meta).toBeUndefined()
		expect(hello.body).toBeUndefined()
	})
})

describe('toExportName', () => {
	it('converts collection name to allCamelCase export name', () => {
		expect(toExportName('docs')).toBe('allDocs')
		expect(toExportName('posts')).toBe('allPosts')
	})

	it('converts hyphenated names to camelCase', () => {
		expect(toExportName('blog-posts')).toBe('allBlogPosts')
		expect(toExportName('my-cool-collection')).toBe('allMyCoolCollection')
	})
})

describe('loadSingleFile', () => {
	it('loads a file in a collection dir and applies schema', async () => {
		const config = defineConfig({
			collections: [
				defineCollection({
					name: 'docs',
					directory: 'content/docs',
					include: '**/*.md',
					schema: z.object({
						title: z.string(),
						subtitle: z.string(),
					}),
				}),
			],
		})
		const overviewPath = path.join(PROJECT_ROOT, 'content', 'docs', 'overview.md')
		const doc = await loadSingleFile(overviewPath, config, PROJECT_ROOT)

		expect(doc.id).toBe('docs/overview')
		expect(doc.data.title).toBe('Overview')
		expect(doc.data.subtitle).toBe('A single-file overview doc.')
		expect(doc.body).toContain('# Overview')
		expect(doc._meta.slug).toBe('overview')
		expect(doc._meta.filename).toBe('overview.md')
	})

	it('loads a file under content/ but outside any collection (no schema)', async () => {
		const config = defineConfig({
			collections: [
				defineCollection({
					name: 'docs',
					directory: 'content/docs',
					include: '**/*.md',
					schema: z.object({ title: z.string() }),
				}),
			],
		})
		const standalonePath = path.join(PROJECT_ROOT, 'content', 'standalone.md')
		const doc = await loadSingleFile(standalonePath, config, PROJECT_ROOT)

		expect(doc.id).toBe('standalone')
		expect(doc.data.title).toBe('Standalone')
		expect(doc.data.custom).toBe(true)
		expect(doc.body).toContain('# Standalone')
	})

	it('loads with config null (no schema, frontmatter passed through)', async () => {
		const overviewPath = path.join(PROJECT_ROOT, 'content', 'docs', 'overview.md')
		const doc = await loadSingleFile(overviewPath, null, PROJECT_ROOT)

		expect(doc.id).toBe('docs/overview')
		expect(doc.data.title).toBe('Overview')
		expect(doc.data.subtitle).toBe('A single-file overview doc.')
	})

	it('throws when file is outside content/', async () => {
		const outsidePath = path.join(FIXTURES_DIR, 'docs', 'hello.md')

		await expect(loadSingleFile(outsidePath, null, PROJECT_ROOT)).rejects.toThrow(
			/not under content directory/
		)
	})
})

describe('getContentRoot', () => {
	it('returns content dir relative to root', () => {
		expect(getContentRoot('/project')).toBe('/project/content')
	})
})

describe('getWatchedDirs', () => {
	it('resolves collection directories to absolute paths (for HMR watch)', () => {
		const config = defineConfig({
			collections: [
				defineCollection({ name: 'a', directory: 'content/a' }),
				defineCollection({ name: 'b', directory: 'src/content/b' }),
			],
		})

		const dirs = getWatchedDirs(config, '/project')
		expect(dirs).toEqual([
			path.resolve('/project', 'content/a'),
			path.resolve('/project', 'src/content/b'),
		])
	})
})

describe('serializeContentModule', () => {
	it('emits ESM with __collections, getCollection(name, filterFn), and serialized data', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [{ title: 'Hello' }])
		loaded.set('posts', [{ title: 'Post 1' }])

		const output = serializeContentModule(loaded)

		expect(output).toContain('export const __aeroContentSchemaIssues = []')
		expect(output).toContain('function getCollection(name, filterFn)')
		expect(output).toContain('__collections[name]')
		expect(output).toContain('"title": "Hello"')
		expect(output).toContain('"title": "Post 1"')
	})

	it('does not emit static allDocs-style exports (only getCollection)', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [])

		const output = serializeContentModule(loaded)

		expect(output).not.toContain('export const allDocs')
	})

	it('re-exports render from @aero-js/content/render', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [])

		const output = serializeContentModule(loaded)

		expect(output).toContain("export { render } from '@aero-js/content/render'")
	})

	it('includes empty collection keys in __collections', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('empty', [])

		const output = serializeContentModule(loaded)
		expect(output).toContain('"empty": []')
	})

	it('embeds __aeroContentSchemaIssues when schemaIssues option is passed', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [])
		const output = serializeContentModule(loaded, {
			schemaIssues: [
				{
					collection: 'docs',
					relPath: 'bad.md',
					file: '/abs/bad.md',
					messages: ['nope'],
				},
			],
		})
		expect(output).toContain('__aeroContentSchemaIssues')
		expect(output).toContain('"collection":"docs"')
		expect(output).toContain('"relPath":"bad.md"')
		expect(output).toContain('nope')
	})

	/** Asserts emitted source contains PROD guard and published filter; does not run getCollection in PROD. */
	it('emits PROD guard that filters by item.data.published === true', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [{ title: 'Published', data: { published: true } }])

		const output = serializeContentModule(loaded)

		expect(output).toContain('import.meta.env.PROD')
		expect(output).toContain('item.data.published === true')
	})

	it('getCollection in PROD filters to only item.data.published === true', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [
			{ id: 'a', data: { published: true }, body: '', _meta: {} },
			{ id: 'b', data: { published: false }, body: '', _meta: {} },
			{ id: 'c', data: { published: true }, body: '', _meta: {} },
		])

		const emitted = serializeContentModule(loaded)
			.replace(/export const __aeroContentSchemaIssues = [\s\S]*?;\s*\n/, '')
			.replace('export function getCollection', 'function getCollection')
			.replace(/export\s*\{\s*render\s*\}\s*from\s*['"][^'"]+['"];?\s*/g, '')
			.replace(/import\.meta\.env\.PROD/g, 'true')

		const getCollection = new Function(emitted + '; return getCollection;')()
		const result = getCollection('docs')

		expect(result).toHaveLength(2)
		expect(result.map((d: any) => d.id)).toEqual(['a', 'c'])
	})
})
