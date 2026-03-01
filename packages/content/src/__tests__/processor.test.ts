/**
 * Tests for the shared markdown processor with optional Shiki syntax highlighting.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { initProcessor, getProcessor, resetProcessor } from '../processor'

beforeEach(() => {
	resetProcessor()
})

describe('getProcessor', () => {
	it('returns a fallback plain processor when initProcessor was never called', () => {
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
	it('creates a plain processor when called without config', async () => {
		await initProcessor()
		const proc = getProcessor()
		expect(proc).toBeDefined()

		// Plain processor should produce simple HTML (no shiki classes)
		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('<code')
		expect(html).toContain('const x = 1')
		expect(html).not.toContain('class="shiki')
	})

	it('creates a Shiki-enabled processor when called with config', async () => {
		await initProcessor({
			theme: 'github-light',
			langs: ['js'],
		})
		const proc = getProcessor()

		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('class="shiki')
		expect(html).toContain('const')
	})

	it('produces multi-theme output with themes', async () => {
		await initProcessor({
			themes: { light: 'github-light', dark: 'github-dark' },
			langs: ['js'],
		})
		const proc = getProcessor()

		const result = await proc.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).toContain('class="shiki')
		expect(html).toContain('--shiki-dark')
	})

	it('applies transformers to code blocks', async () => {
		const { transformerNotationHighlight } = await import('@shikijs/transformers')

		await initProcessor({
			theme: 'github-light',
			langs: ['js'],
			transformers: [transformerNotationHighlight()],
		})
		const proc = getProcessor()

		const result = await proc.process('```js\nconst x = 1 // [!code highlight]\n```')
		const html = String(result)
		expect(html).toContain('highlighted')
	})

	it('replaces the processor on subsequent calls', async () => {
		await initProcessor()
		const p1 = getProcessor()

		await initProcessor({ theme: 'github-light', langs: ['js'] })
		const p2 = getProcessor()

		expect(p1).not.toBe(p2)
	})
})

describe('resetProcessor', () => {
	it('clears the processor so a fresh one is created', async () => {
		await initProcessor({ theme: 'github-light', langs: ['js'] })
		const p1 = getProcessor()

		resetProcessor()

		const p2 = getProcessor()
		expect(p1).not.toBe(p2)

		// After reset, fallback should be plain (no Shiki)
		const result = await p2.process('```js\nconst x = 1\n```')
		const html = String(result)
		expect(html).not.toContain('class="shiki')
	})
})

describe('non-code markdown passthrough', () => {
	it('renders headings and paragraphs the same with Shiki enabled', async () => {
		await initProcessor({
			theme: 'github-light',
			langs: ['js'],
		})
		const proc = getProcessor()

		const result = await proc.process('# Hello\n\nA paragraph.')
		const html = String(result)
		expect(html).toContain('<h1>Hello</h1>')
		expect(html).toContain('<p>A paragraph.</p>')
	})
})
