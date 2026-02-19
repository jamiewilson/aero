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
	it('should discover and load all markdown files', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!

		expect(docs).toBeDefined()
		expect(docs.length).toBe(3)
	})

	it('should parse frontmatter correctly', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d._meta.slug === 'hello')

		expect(hello).toBeDefined()
		expect(hello.data.title).toBe('Test Post')
		expect(hello.data.subtitle).toBe('A test subtitle')
		expect(hello.data.date).toBeInstanceOf(Date)
	})

	it('should set id from collection-relative path', async () => {
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

	it('should generate correct _meta for root-level files', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d.id === 'hello')

		expect(hello._meta.path).toBe('hello')
		expect(hello._meta.slug).toBe('hello')
		expect(hello._meta.filename).toBe('hello.md')
		expect(hello._meta.extension).toBe('.md')
	})

	it('should generate correct _meta for nested files', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const nested = docs.find((d: any) => d.id === 'guides/nested')

		expect(nested).toBeDefined()
		expect(nested._meta.path).toBe('guides/nested')
		expect(nested._meta.slug).toBe('nested')
		expect(nested._meta.filename).toBe('nested.md')
	})

	it('should include raw markdown as body field', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const hello = docs.find((d: any) => d.id === 'hello')

		expect(hello.body).toContain('# Hello World')
		expect(hello.body).toContain('**test**')
	})

	it('should handle optional schema fields', async () => {
		const config = defineConfig({ collections: [docsCollection] })
		const loaded = await loadAllCollections(config, '/')
		const docs = loaded.get('docs')!
		const second = docs.find((d: any) => d.id === 'second')

		expect(second).toBeDefined()
		expect(second.data.title).toBe('Second Post')
		expect(second.data.subtitle).toBeUndefined()
	})

	it('should skip files that fail schema validation', async () => {
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

	it('should load without schema validation when no schema provided', async () => {
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

	it('should apply transforms when provided', async () => {
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
		// Transform replaces the document shape — no _meta or body
		expect(hello._meta).toBeUndefined()
		expect(hello.body).toBeUndefined()
	})
})

describe('toExportName', () => {
	it('should convert simple names', () => {
		expect(toExportName('docs')).toBe('allDocs')
		expect(toExportName('posts')).toBe('allPosts')
	})

	it('should convert hyphenated names to camelCase', () => {
		expect(toExportName('blog-posts')).toBe('allBlogPosts')
		expect(toExportName('my-cool-collection')).toBe('allMyCoolCollection')
	})
})

describe('getWatchedDirs', () => {
	it('should resolve absolute paths for all collection directories', () => {
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
	it('should produce a getCollection function', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [{ title: 'Hello' }])
		loaded.set('posts', [{ title: 'Post 1' }])

		const output = serializeContentModule(loaded)

		expect(output).toContain('function getCollection(name, filterFn)')
		expect(output).toContain('__collections[name]')
		expect(output).toContain('"title": "Hello"')
		expect(output).toContain('"title": "Post 1"')
	})

	it('should not produce static allDocs exports', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [])

		const output = serializeContentModule(loaded)

		expect(output).not.toContain('export const allDocs')
	})

	it('should re-export render from @aero-ssg/content/render', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [])

		const output = serializeContentModule(loaded)

		expect(output).toContain("export { render } from '@aero-ssg/content/render'")
	})

	it('should handle empty collections', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('empty', [])

		const output = serializeContentModule(loaded)
		expect(output).toContain('"empty": []')
	})

	it('should include PROD filter for published documents', () => {
		const loaded = new Map<string, any[]>()
		loaded.set('docs', [{ title: 'Published', data: { published: true } }])

		const output = serializeContentModule(loaded)

		expect(output).toContain('import.meta.env.PROD')
		expect(output).toContain("item.data.published === true")
	})
})
