import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('aero-globals site pattern', () => {
	it('does not inject site.property content-global highlighting', () => {
		const grammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-globals.json')
		const grammar = JSON.parse(readFileSync(grammarPath, 'utf8')) as {
			patterns: Array<{ match?: string }>
		}

		const sitePropertyRule = grammar.patterns.find(p => p.match?.includes('site'))
		expect(sitePropertyRule).toBeUndefined()
	})

	it('excludes string literals from globals injection so import paths are not highlighted', () => {
		const grammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-globals.json')
		const grammar = JSON.parse(readFileSync(grammarPath, 'utf8')) as {
			injectionSelector: string
		}

		expect(grammar.injectionSelector).toContain('-string')
	})
})
