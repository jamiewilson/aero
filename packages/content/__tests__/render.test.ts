import { describe, it, expect } from 'vitest'
import { render } from '../render'
import type { ContentDocument } from '../types'

function makeDoc(body: string): ContentDocument {
	return {
		id: 'test',
		data: { title: 'Test' },
		body,
		_meta: { path: 'test', slug: 'test', filename: 'test.md', extension: '.md' },
	}
}

describe('render', () => {
	it('should return an object with html property', async () => {
		const result = await render(makeDoc('# Hello'))
		expect(result).toHaveProperty('html')
		expect(typeof result.html).toBe('string')
	})

	it('should compile markdown to HTML', async () => {
		const { html } = await render(makeDoc('# Hello World'))
		expect(html).toContain('<h1>Hello World</h1>')
	})

	it('should handle bold and italic', async () => {
		const { html } = await render(makeDoc('**bold** and *italic*'))
		expect(html).toContain('<strong>bold</strong>')
		expect(html).toContain('<em>italic</em>')
	})

	it('should handle lists', async () => {
		const { html } = await render(makeDoc('- one\n- two'))
		expect(html).toContain('<li>one</li>')
		expect(html).toContain('<li>two</li>')
	})

	it('should handle empty body', async () => {
		const { html } = await render(makeDoc(''))
		expect(html).toBe('')
	})

	it('should handle links', async () => {
		const { html } = await render(makeDoc('[test](https://example.com)'))
		expect(html).toContain('<a href="https://example.com">test</a>')
	})
})
