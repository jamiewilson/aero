import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('aero-attributes grammar', () => {
	const grammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-attributes.json')
	const grammar = JSON.parse(readFileSync(grammarPath, 'utf8')) as {
		injectionSelector: string
		patterns: Array<{ include?: string }>
	}

	it('excludes string literals so directive keywords in prop values are not highlighted', () => {
		expect(grammar.injectionSelector).toContain('-string')
	})

	it('keeps flat attribute-name patterns for real Aero directives', () => {
		expect(grammar.patterns.map(p => p.include)).toEqual([
			'#aero-script-type-attributes',
			'#aero-control-flow-attributes',
			'#aero-props-attribute',
		])
	})
})
