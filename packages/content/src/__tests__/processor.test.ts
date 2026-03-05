/**
 * Tests for the shared markdown processor with pluggable remark/rehype pipeline.
 */
import type { Root } from 'hast'
import type { Plugin } from 'unified'
import { describe, it, expect, beforeEach } from 'vitest'
import { initProcessor, getProcessor, resetProcessor } from '../processor'

beforeEach(() => {
	resetProcessor()
})

describe('getProcessor', () => {
	it('returns a fallback processor when initProcessor was never called', () => {
		const proc = getProcessor()
		expect(proc).toBeDefined()
		expect(typeof proc.process).toBe('function')
	})

	it('returns the same instance on subsequent calls', () => {
		const p1 = getProcessor()
		const p2 = getProcessor()
		expect(p1).toBe(p2)
	})
})

describe('initProcessor', () => {
	it('creates a processor when called without config', async () => {
		await initProcessor()
		const proc = getProcessor()
		expect(proc).toBeDefined()

		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('<code')
		expect(html).toContain('const x = 1')
		expect(html).not.toContain('class="shiki')
	})

	it('applies @shikijs/rehype as a rehype plugin', async () => {
		const rehypeShiki = (await import('@shikijs/rehype')).default

		await initProcessor({
			rehypePlugins: [[rehypeShiki, { theme: 'github-light', langs: ['js'] }]],
		})
		const proc = getProcessor()

		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('class="shiki')
		expect(html).toContain('const')
	})

	it('produces multi-theme output with @shikijs/rehype themes', async () => {
		const rehypeShiki = (await import('@shikijs/rehype')).default

		await initProcessor({
			rehypePlugins: [
				[
					rehypeShiki,
					{
						themes: { light: 'github-light', dark: 'github-dark' },
						langs: ['js'],
					},
				],
			],
		})
		const proc = getProcessor()

		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('class="shiki')
		expect(html).toContain('--shiki-dark')
	})

	it('applies transformers via @shikijs/rehype', async () => {
		const rehypeShiki = (await import('@shikijs/rehype')).default
		const { transformerNotationHighlight } =
			await import('@shikijs/transformers')

		await initProcessor({
			rehypePlugins: [
				[
					rehypeShiki,
					{
						theme: 'github-light',
						langs: ['js'],
						transformers: [transformerNotationHighlight()],
					},
				],
			],
		})
		const proc = getProcessor()

		const result = await proc.process(
			'```js\nconst x = 1 // [!code highlight]\n```'
		)
		const html = String(result)
		expect(html).toContain('highlighted')
	})

	it('replaces the processor on subsequent calls', async () => {
		await initProcessor()
		const p1 = getProcessor()

		const rehypeShiki = (await import('@shikijs/rehype')).default
		await initProcessor({
			rehypePlugins: [[rehypeShiki, { theme: 'github-light', langs: ['js'] }]],
		})
		const p2 = getProcessor()

		expect(p1).not.toBe(p2)
	})
})

describe('resetProcessor', () => {
	it('clears the processor so a fresh one is created', async () => {
		const rehypeShiki = (await import('@shikijs/rehype')).default

		await initProcessor({
			rehypePlugins: [[rehypeShiki, { theme: 'github-light', langs: ['js'] }]],
		})
		const p1 = getProcessor()

		resetProcessor()

		const p2 = getProcessor()
		expect(p1).not.toBe(p2)

		const result = await p2.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).not.toContain('class="shiki')
	})
})

describe('non-code markdown passthrough', () => {
	it('renders headings and paragraphs with rehype plugins', async () => {
		const rehypeShiki = (await import('@shikijs/rehype')).default

		await initProcessor({
			rehypePlugins: [[rehypeShiki, { theme: 'github-light', langs: ['js'] }]],
		})
		const proc = getProcessor()

		const result = await proc.process('# Hello\n\nA paragraph.')
		const html = String(result)
		expect(html).toContain('<h1>Hello</h1>')
		expect(html).toContain('<p>A paragraph.</p>')
	})
})

describe('custom remark plugins', () => {
	it('applies remark plugins to the pipeline', async () => {
		const remarkUpperHeadings: Plugin = () => (tree: any) => {
			const visit = (node: any) => {
				if (node.type === 'heading' && node.children?.[0]?.type === 'text') {
					node.children[0].value = node.children[0].value.toUpperCase()
				}
				if (node.children) node.children.forEach(visit)
			}
			visit(tree)
		}

		await initProcessor({
			remarkPlugins: [remarkUpperHeadings],
		})
		const proc = getProcessor()

		const result = await proc.process('# Hello')
		const html = String(result)
		expect(html).toContain('HELLO')
	})

	it('applies remark plugins alongside rehype plugins', async () => {
		const rehypeShiki = (await import('@shikijs/rehype')).default

		const remarkAddClass: Plugin = () => (tree: any) => {
			const visit = (node: any) => {
				if (node.type === 'heading') {
					node.data ??= {}
					node.data.hProperties ??= {}
					node.data.hProperties.class = 'custom-heading'
				}
				if (node.children) node.children.forEach(visit)
			}
			visit(tree)
		}

		await initProcessor({
			remarkPlugins: [remarkAddClass],
			rehypePlugins: [[rehypeShiki, { theme: 'github-light', langs: ['js'] }]],
		})
		const proc = getProcessor()

		const result = await proc.process('# Hello\n\n```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('custom-heading')
		expect(html).toContain('class="shiki')
	})
})

describe('custom rehype plugins', () => {
	it('applies rehype plugins to the pipeline', async () => {
		const rehypeAddDataAttr: Plugin<[], Root> = () => tree => {
			const visit = (node: any) => {
				if (node.type === 'element' && node.tagName === 'pre') {
					node.properties ??= {}
					node.properties['data-test'] = 'true'
				}
				if (node.children) node.children.forEach(visit)
			}
			visit(tree)
		}

		await initProcessor({
			rehypePlugins: [rehypeAddDataAttr],
		})
		const proc = getProcessor()

		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('data-test="true"')
	})

	it('applies multiple rehype plugins in order', async () => {
		const rehypeShiki = (await import('@shikijs/rehype')).default

		const rehypeAddDataAttr: Plugin<[], Root> = () => tree => {
			const visit = (node: any) => {
				if (node.type === 'element' && node.tagName === 'pre') {
					node.properties ??= {}
					node.properties['data-test'] = 'true'
				}
				if (node.children) node.children.forEach(visit)
			}
			visit(tree)
		}

		await initProcessor({
			rehypePlugins: [
				[rehypeShiki, { theme: 'github-light', langs: ['js'] }],
				rehypeAddDataAttr,
			],
		})
		const proc = getProcessor()

		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('class="shiki')
		expect(html).toContain('data-test="true"')
	})
})
