import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

describe('aero-slot-void grammar', () => {
	const grammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-slot-void.json')
	const grammar = JSON.parse(readFileSync(grammarPath, 'utf8')) as {
		injectionSelector: string
		patterns: Array<{ name?: string; begin?: string; end?: string; endCaptures?: Record<string, unknown> }>
	}

	it('registers void slot scoping with L-priority injection before html structure tags', () => {
		expect(grammar.injectionSelector).toMatch(/^L:/)
		expect(grammar.injectionSelector).toContain('text.html.basic')
		expect(grammar.injectionSelector).toContain('-meta.embedded.expression.aero')
		expect(grammar.patterns[0]?.name).toBe('meta.tag.structure.slot.void.html')
		expect(grammar.patterns[0]?.begin).toContain('slot')
		expect(grammar.patterns[0]?.end).toBe('/?>')
		expect(grammar.patterns[0]?.endCaptures?.['0']).toEqual({
			name: 'punctuation.definition.tag.end.html',
		})
	})
})

const htmlGrammarPath =
	'/Applications/Cursor.app/Contents/Resources/app/extensions/html/syntaxes/html.tmLanguage.json'

describe.skipIf(!existsSync(htmlGrammarPath))('aero-slot-void tokenization', () => {
	it('scopes /> as a single tag-end token like br void tags', async () => {
		const slotGrammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-slot-void.json')
		const { Registry, parseRawGrammar, INITIAL } = require('vscode-textmate')
		const { loadWASM, createOnigScanner, createOnigString } = require('vscode-oniguruma')

		const wasmPath = path.join(
			import.meta.dirname,
			'..',
			'..',
			'node_modules',
			'vscode-oniguruma/release/onig.wasm',
		)
		await loadWASM(readFileSync(wasmPath).buffer)

		const onigLib = {
			createOnigScanner,
			createOnigString,
		}

		const slotGrammar = parseRawGrammar(readFileSync(slotGrammarPath, 'utf8'), slotGrammarPath)
		slotGrammar.injectionSelector = 'L:text.html.basic'

		const reg = new Registry({
			onigLib: Promise.resolve(onigLib),
			loadGrammar: async (scope: string) => {
				if (scope === 'text.html.basic') {
					return parseRawGrammar(readFileSync(htmlGrammarPath, 'utf8'), htmlGrammarPath)
				}
				if (scope === 'aero.slot-void.injection') {
					return slotGrammar
				}
				return null
			},
			getInjections: (scopeName: string) =>
				scopeName === 'text.html.basic' ? ['aero.slot-void.injection'] : [],
		})

		const g = await reg.loadGrammar('text.html.basic')
		const line = '<slot name="x" />'

		const brLine = '<br />'
		const brTokens = g!.tokenizeLine(brLine, INITIAL).tokens
		const slotTokens = g!.tokenizeLine(line, INITIAL).tokens

		const brClose = brTokens.find((t) => brLine.slice(t.startIndex, t.endIndex) === '/>')
		const slotClose = slotTokens.find((t) => line.slice(t.startIndex, t.endIndex) === '/>')

		expect(brClose).toBeDefined()
		expect(brClose!.scopes).toContain('punctuation.definition.tag.end.html')

		expect(slotClose).toBeDefined()
		expect(slotClose!.scopes).toContain('punctuation.definition.tag.end.html')
		expect(slotClose!.scopes).toContain('meta.tag.structure.slot.void.html')
	})
})
