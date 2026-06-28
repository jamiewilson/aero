import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SITE_GLOBAL_PATTERN = /\b(site)(\.)([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g

describe('aero-globals site pattern', () => {
	it('matches site.property in code but also site.ts inside import path text', () => {
		const specifier = '@content/site.ts'
		const codeUsage = 'site.home.title'
		const inSpecifier = [...specifier.matchAll(SITE_GLOBAL_PATTERN)].map(m => m[0])
		const inCode = [...codeUsage.matchAll(SITE_GLOBAL_PATTERN)].map(m => m[0])

		expect(inCode).toEqual(['site.home'])
		expect(inSpecifier).toEqual(['site.ts'])
	})

	it('excludes string literals from globals injection so import paths are not highlighted', () => {
		const grammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-globals.json')
		const grammar = JSON.parse(readFileSync(grammarPath, 'utf8')) as {
			injectionSelector: string
		}

		expect(grammar.injectionSelector).toContain('-string')
	})
})
