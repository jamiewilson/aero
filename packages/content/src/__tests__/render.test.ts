/**
 * Tests for render(): lazy markdown-to-HTML used in pages (import from aero:content).
 * Same remark pipeline as compileMarkdown; handles null/undefined and returns { html }.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '../render'

describe('render', () => {
	it('returns { html } for a valid document body', async () => {
		const doc = {
			id: 'test',
			body: '# Hello',
			data: {},
			_meta: { filename: 'test.md', slug: 'test', path: 'test', extension: '.md' },
		}
		const result = await render(doc as any)
		expect(result.html).toContain('<h1>Hello</h1>')
	})

	it('returns empty HTML and warns when document is null', async () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const result = await render(null)
		expect(result.html).toBe('')
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('render() received null'))
		consoleSpy.mockRestore()
	})

	it('returns empty HTML and warns when document is undefined', async () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const result = await render(undefined)
		expect(result.html).toBe('')
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('render() received null'))
		consoleSpy.mockRestore()
	})
	// TODO: edge case — document with empty body (e.g. body === '') returns { html: '' }
})
