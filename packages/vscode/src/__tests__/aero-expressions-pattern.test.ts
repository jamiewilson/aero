import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('aero-expressions grammar', () => {
	const grammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-expressions.json')
	const grammar = JSON.parse(readFileSync(grammarPath, 'utf8')) as {
		injectionSelector: string
		patterns: Array<{
			name?: string
			contentName?: string
			beginCaptures?: Record<string, { name?: string }>
			endCaptures?: Record<string, { name?: string }>
		}>
	}

	it('wraps braced expressions in meta.embedded.block for tokenTypes reset', () => {
		const rule = grammar.patterns[0]
		expect(rule.name).toBe('meta.embedded.block.expression.aero')
		expect(rule.contentName).toBe('meta.embedded.expression.aero source.ts')
	})

	it('uses string delimiter scopes on braces so themes color them like quotes', () => {
		const rule = grammar.patterns[0]
		expect(rule.beginCaptures?.['1']?.name).toContain('punctuation.definition.string.begin.html')
		expect(rule.endCaptures?.['1']?.name).toContain('punctuation.definition.string.end.html')
	})

	it('injects with right priority over html string rules', () => {
		expect(grammar.injectionSelector).toMatch(/^R:/)
		expect(grammar.injectionSelector).not.toContain('L:')
		expect(grammar.injectionSelector).toContain('text.html.basic')
		expect(grammar.injectionSelector).not.toContain('text.html.aero')
	})
})
