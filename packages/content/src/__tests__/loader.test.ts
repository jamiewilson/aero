/**
 * Tests for the content loader: collection discovery, frontmatter parsing,
 * schema validation, transforms, and virtual module serialization.
 */
import { describe, it, expect, vi } from 'vitest'
import {
	loadAllCollections,
	getWatchedDirs,
	toExportName,
	serializeContentModule,
} from '../loader'
import { defineCollection, defineConfig } from '../types'
import { z } from 'zod'
import path from 'node:path'

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures')

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
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!

		expect(docs).toBeDefined()
		expect(docs.length).toBe(3)
	})

	it('parses frontmatter (gray-matter) and applies Zod schema', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d._meta.slug === 'hello')

		expect(hello).toBeDefined()
		expect(hello.data.title).toBe('Test Post')
		expect(hello.data.subtitle).toBe('A test subtitle')
		expect(hello.data.date).toBeInstanceOf(Date)
	})

	it('sets id from collection-relative path (dir/name for nested files)', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
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
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d.id === 'hello')

		expect(hello._meta.path).toBe('hello')
		expect(hello._meta.slug).toBe('hello')
		expect(hello._meta.filename).toBe('hello.md')
		expect(hello._meta.extension).toBe('.md')
	})

	it('generates _meta for nested files (slug is basename only)', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const nested = docs.find((d: any) => d.id === 'guides/nested')

		expect(nested).toBeDefined()
		expect(nested._meta.path).toBe('guides/nested')
		expect(nested._meta.slug).toBe('nested')
		expect(nested._meta.filename).toBe('nested.md')
	})

	it('includes raw markdown (post-frontmatter) as body', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d.id === 'hello')

		expect(hello.body).toContain('# Hello World')
		expect(hello.body).toContain('**test**')
	})

	it('allows optional schema fields to be omitted in frontmatter', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const second = docs.find((d: any) => d.id === 'second')

		expect(second).toBeDefined()
		expect(second.data.title).toBe('Second Post')
		expect(second.data.subtitle).toBeUndefined()
	})

	it('skips files that fail schema validation and warns with file path', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const invalidCollection = defineCollection({
			name: 'invalid',
			directory: path.resolve(FIXTURES_DIR, 'invalid'),
			include: '**/*.md',
			schema: z.object({ title: z.string() }),
		})

		const config = defineConfig({ collections: [invalidCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('invalid')!

		expect(docs.length).toBe(0)
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping "bad.md"'))

		warnSpy.mockRestore()
	})

	it('loads without schema validation when no schema is provided', async () => {
		const noSchemaCollection = defineCollection({
			name: 'raw',
			directory: path.resolve(FIXTURES_DIR, 'docs'),
			include: '**/*.md',
		})

		const config = defineConfig({ collections: [noSchemaCollection] })
		const loaded = await loadAllCollections(config, '/')
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
		const loaded = await loadAllCollections(config, '/')
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

	it('re-exports render from @aerobuilt/content/render', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [])

		const output = serializeContentModule(loaded)

		expect(output).toContain("export { render } from '@aerobuilt/content/render'")
	})

	it('includes empty collection keys in __collections', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('empty', [])

		const output = serializeContentModule(loaded)
		expect(output).toContain('"empty": []')
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
			.replace('export function getCollection', 'function getCollection')
			.replace(/export\s*\{\s*render\s*\}\s*from\s*['"][^'"]+['"];?\s*/g, '')
			.replace(/import\.meta\.env\.PROD/g, 'true')

		const getCollection = new Function(emitted + '; return getCollection;')()
		const result = getCollection('docs')

		expect(result).toHaveLength(2)
		expect(result.map((d: any) => d.id)).toEqual(['a', 'c'])
	})
})
