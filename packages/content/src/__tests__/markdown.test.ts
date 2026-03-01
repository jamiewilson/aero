/**
 * Tests for compileMarkdown (remark pipeline): document body → HTML.
 * Uses shared processor from processor.ts; reset before each test for clean state.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { compileMarkdown } from '../markdown'
import { resetProcessor, initProcessor } from '../processor'
import type { ContentDocument } from '../types'

function makeDoc(body: string): ContentDocument {
	return {
		id: 'test',
		data: { title: 'Test' },
		body,
		_meta: { path: 'test', slug: 'test', filename: 'test.md', extension: '.md' },
	}
}

describe('compileMarkdown', () => {
	beforeEach(() => {
		resetProcessor()
	})

	it('converts markdown headings to HTML', async () => {
		const html = await compileMarkdown(makeDoc('# Hello World'))
		expect(html).toContain('<h1>Hello World</h1>')
	})

	it('converts bold text', async () => {
		const html = await compileMarkdown(makeDoc('This is **bold** text'))
		expect(html).toContain('<strong>bold</strong>')
	})

	it('converts italic text', async () => {
		const html = await compileMarkdown(makeDoc('This is *italic* text'))
		expect(html).toContain('<em>italic</em>')
	})

	it('converts unordered lists', async () => {
		const html = await compileMarkdown(makeDoc('- Item one\n- Item two'))
		expect(html).toContain('<ul>')
		expect(html).toContain('<li>Item one</li>')
		expect(html).toContain('<li>Item two</li>')
	})

	it('converts links', async () => {
		const html = await compileMarkdown(makeDoc('[Link](https://example.com)'))
		expect(html).toContain('<a href="https://example.com">Link</a>')
	})

	it('converts fenced code blocks', async () => {
		const html = await compileMarkdown(makeDoc('```js\nconst x = 1\n```'))
		expect(html).toContain('<code')
		expect(html).toContain('const x = 1')
	})

	it('converts inline code', async () => {
		const html = await compileMarkdown(makeDoc('Use `foo()` here'))
		expect(html).toContain('<code>foo()</code>')
	})

	it('returns empty string for empty body', async () => {
		const html = await compileMarkdown(makeDoc(''))
		expect(html).toBe('')
	})

	it('converts paragraphs (double newline separated)', async () => {
		const html = await compileMarkdown(makeDoc('First paragraph\n\nSecond paragraph'))
		expect(html).toContain('<p>First paragraph</p>')
		expect(html).toContain('<p>Second paragraph</p>')
	})

	it('does not output raw script tags (XSS regression if remark-html config allows raw HTML)', async () => {
		const html = await compileMarkdown(makeDoc('Text <script>alert(1)</script> more'))
		expect(html).not.toContain('<script>')
		expect(html).not.toContain('</script>')
	})

	it('highlights fenced code blocks when Shiki is enabled', async () => {
		await initProcessor({
			theme: 'github-light',
			langs: ['js'],
		})
		const html = await compileMarkdown(makeDoc('```js\nconst x = 1\n```'))
		expect(html).toContain('class="shiki')
		expect(html).toContain('const')
	})

	it('produces plain code blocks without Shiki config', async () => {
		await initProcessor()
		const html = await compileMarkdown(makeDoc('```js\nconst x = 1\n```'))
		expect(html).toContain('<code')
		expect(html).toContain('const x = 1')
		expect(html).not.toContain('class="shiki')
	})
})
