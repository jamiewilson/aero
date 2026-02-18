import { describe, it, expect } from 'vitest'
import { compileMarkdown } from '../markdown'
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
	it('should convert markdown headings to HTML', async () => {
		const html = await compileMarkdown(makeDoc('# Hello World'))
		expect(html).toContain('<h1>Hello World</h1>')
	})

	it('should convert bold text', async () => {
		const html = await compileMarkdown(makeDoc('This is **bold** text'))
		expect(html).toContain('<strong>bold</strong>')
	})

	it('should convert italic text', async () => {
		const html = await compileMarkdown(makeDoc('This is *italic* text'))
		expect(html).toContain('<em>italic</em>')
	})

	it('should convert unordered lists', async () => {
		const html = await compileMarkdown(makeDoc('- Item one\n- Item two'))
		expect(html).toContain('<ul>')
		expect(html).toContain('<li>Item one</li>')
		expect(html).toContain('<li>Item two</li>')
	})

	it('should convert links', async () => {
		const html = await compileMarkdown(makeDoc('[Link](https://example.com)'))
		expect(html).toContain('<a href="https://example.com">Link</a>')
	})

	it('should convert code blocks', async () => {
		const html = await compileMarkdown(makeDoc('```js\nconst x = 1\n```'))
		expect(html).toContain('<code')
		expect(html).toContain('const x = 1')
	})

	it('should convert inline code', async () => {
		const html = await compileMarkdown(makeDoc('Use `foo()` here'))
		expect(html).toContain('<code>foo()</code>')
	})

	it('should handle empty content', async () => {
		const html = await compileMarkdown(makeDoc(''))
		expect(html).toBe('')
	})

	it('should convert paragraphs', async () => {
		const html = await compileMarkdown(makeDoc('First paragraph\n\nSecond paragraph'))
		expect(html).toContain('<p>First paragraph</p>')
		expect(html).toContain('<p>Second paragraph</p>')
	})
})
