/**
 * Tests for render(): lazy markdown-to-HTML used in pages (import from aero:content).
 * Uses shared processor from processor.ts; reset before each test for clean state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../render'
import { resetProcessor, initProcessor } from '../processor'

beforeEach(() => {
	resetProcessor()
})

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

	it('returns { html: "" } when document body is empty', async () => {
		const doc = {
			id: 'test',
			body: '',
			data: {},
			_meta: { filename: 'test.md', slug: 'test', path: 'test', extension: '.md' },
		}
		const result = await render(doc as any)
		expect(result).toEqual({ html: '' })
	})

	it('highlights code blocks when Shiki is enabled', async () => {
		await initProcessor({
			theme: 'github-light',
			langs: ['js'],
		})
		const doc = {
			id: 'test',
			body: '```js\nconst x = 1\n```',
			data: {},
			_meta: { filename: 'test.md', slug: 'test', path: 'test', extension: '.md' },
		}
		const result = await render(doc as any)
		expect(result.html).toContain('class="shiki')
		expect(result.html).toContain('const')
	})
})
