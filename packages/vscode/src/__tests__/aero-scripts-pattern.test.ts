import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const grammarPath = path.join(import.meta.dirname, '..', '..', 'syntaxes', 'aero-scripts.json')
const manifestPath = path.join(import.meta.dirname, '..', '..', 'package.json')

describe('aero-scripts grammar', () => {
	const grammar = JSON.parse(readFileSync(grammarPath, 'utf8')) as {
		injectionSelector: string
		patterns: Array<{ include?: string }>
		repository: Record<
			string,
			{ begin?: string; patterns?: Array<{ contentName?: string }> }
		>
	}

	it('registers L-priority injection into native HTML scopes', () => {
		expect(grammar.injectionSelector).toMatch(/^L:/)
		expect(grammar.injectionSelector).toContain('text.html.basic')
		expect(grammar.injectionSelector).toContain('text.html.derivative')
		expect(grammar.injectionSelector).not.toContain('text.html.aero')
	})

	it('scopes build/state and explicit lang=ts bodies as source.ts', () => {
		const bodyNames = Object.values(grammar.repository).flatMap(
			rule => rule.patterns?.map(p => p.contentName).filter(Boolean) ?? []
		)
		expect(bodyNames).toContain('source.ts')
		expect(bodyNames).toContain('source.json')
		expect(grammar.repository['aero-typescript-default']?.begin).toContain('is:(?:build|state)')
	})

	it('maps source.ts to typescript in the extension manifest', () => {
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
			contributes: {
				grammars: Array<{
					scopeName?: string
					embeddedLanguages?: Record<string, string>
				}>
			}
		}
		const scripts = manifest.contributes.grammars.find(g => g.scopeName === 'aero.scripts.injection')
		expect(scripts?.embeddedLanguages?.['meta.embedded.block.ts.aero']).toBe('typescript')
		expect(scripts?.embeddedLanguages?.['source.ts']).toBe('typescript')
		expect(scripts?.embeddedLanguages?.['meta.embedded.block.importmap.aero']).toBe('json')
		expect(scripts?.embeddedLanguages?.['source.json']).toBe('json')
	})
})

const htmlGrammarPath =
	'/Applications/Cursor.app/Contents/Resources/app/extensions/html/syntaxes/html.tmLanguage.json'
const tsGrammarPath =
	'/Applications/Cursor.app/Contents/Resources/app/extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json'
const jsGrammarPath =
	'/Applications/Cursor.app/Contents/Resources/app/extensions/javascript/syntaxes/JavaScript.tmLanguage.json'
const jsonGrammarPath =
	'/Applications/Cursor.app/Contents/Resources/app/extensions/json/syntaxes/JSON.tmLanguage.json'

function bodyHasScope(
	line: string,
	tokens: Array<{ startIndex: number; endIndex: number; scopes: string[] }>,
	scope: string
): boolean {
	const openEnd = line.indexOf('>') + 1
	const closeStart = line.lastIndexOf('</')
	return tokens.some(t => {
		if (t.endIndex <= openEnd || t.startIndex >= closeStart) return false
		return t.scopes.some(s => s === scope || s.startsWith(`${scope}.`))
	})
}

describe.skipIf(!existsSync(htmlGrammarPath))('aero-scripts tokenization', () => {
	async function tokenize(line: string) {
		const { Registry, parseRawGrammar, INITIAL } = require('vscode-textmate')
		const { loadWASM, createOnigScanner, createOnigString } = require('vscode-oniguruma')

		const pkgDir = path.dirname(require.resolve('vscode-oniguruma/package.json'))
		await loadWASM(readFileSync(path.join(pkgDir, 'release/onig.wasm')).buffer)

		const onigLib = { createOnigScanner, createOnigString }
		const scriptsGrammar = parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath)
		scriptsGrammar.injectionSelector = 'L:text.html.basic'

		const reg = new Registry({
			onigLib: Promise.resolve(onigLib),
			loadGrammar: async (scope: string) => {
				if (scope === 'text.html.basic') {
					return parseRawGrammar(readFileSync(htmlGrammarPath, 'utf8'), htmlGrammarPath)
				}
				if (scope === 'aero.scripts.injection') return scriptsGrammar
				if (scope === 'source.ts' && existsSync(tsGrammarPath)) {
					return parseRawGrammar(readFileSync(tsGrammarPath, 'utf8'), tsGrammarPath)
				}
				if (scope === 'source.js' && existsSync(jsGrammarPath)) {
					return parseRawGrammar(readFileSync(jsGrammarPath, 'utf8'), jsGrammarPath)
				}
				if (scope === 'source.json' && existsSync(jsonGrammarPath)) {
					return parseRawGrammar(readFileSync(jsonGrammarPath, 'utf8'), jsonGrammarPath)
				}
				return null
			},
			getInjections: (scopeName: string) =>
				scopeName === 'text.html.basic' ? ['aero.scripts.injection'] : [],
		})

		const g = await reg.loadGrammar('text.html.basic')
		const result = g!.tokenizeLine(line, INITIAL)
		return {
			tokens: result.tokens,
			scopes: [...new Set(result.tokens.flatMap((t: { scopes: string[] }) => t.scopes))],
		}
	}

	it('scopes is:build default as TypeScript', async () => {
		const line = `<script is:build>import type { X } from './x'</script>`
		const { tokens, scopes } = await tokenize(line)
		expect(scopes.some(s => s.includes('source.ts'))).toBe(true)
		expect(bodyHasScope(line, tokens, 'source.js')).toBe(false)
	})

	it('scopes is:state default as TypeScript', async () => {
		const line = `<script is:state>let n: number = 1</script>`
		const { scopes } = await tokenize(line)
		expect(scopes.some(s => s.includes('source.ts'))).toBe(true)
	})

	it('scopes indented is:build as TypeScript', async () => {
		const line = `\t<script is:build>const x: number = 1</script>`
		const { scopes } = await tokenize(line)
		expect(scopes.some(s => s.includes('source.ts'))).toBe(true)
	})

	it('keeps lang="js" opt-out as JavaScript', async () => {
		const line = `<script is:build lang="js">const x = 1</script>`
		const { scopes } = await tokenize(line)
		expect(scopes.some(s => s.includes('source.ts'))).toBe(false)
		expect(scopes.some(s => s.includes('source.js'))).toBe(true)
	})

	it('keeps lang="javascript" opt-out as JavaScript', async () => {
		const line = `<script is:state lang="javascript">let x = 1</script>`
		const { scopes } = await tokenize(line)
		expect(scopes.some(s => s.includes('source.ts'))).toBe(false)
		expect(scopes.some(s => s.includes('source.js'))).toBe(true)
	})

	it('scopes lang="ts" scripts as TypeScript', async () => {
		const line = `<script lang="ts">const x: number = 1</script>`
		const { scopes } = await tokenize(line)
		expect(scopes.some(s => s.includes('source.ts'))).toBe(true)
	})

	it('leaves plain scripts as JavaScript', async () => {
		const line = `<script>console.log(1)</script>`
		const { scopes } = await tokenize(line)
		expect(scopes.some(s => s.includes('source.ts'))).toBe(false)
		expect(scopes.some(s => s.includes('source.js'))).toBe(true)
	})

	it('scopes importmap bodies as JSON', async () => {
		const line = `<script type="importmap">{"imports":{}}</script>`
		const { tokens, scopes } = await tokenize(line)
		expect(
			scopes.some(s => s.includes('source.json') || s.includes('meta.embedded.block.importmap'))
		).toBe(true)
		expect(bodyHasScope(line, tokens, 'source.json') || scopes.some(s => s.includes('meta.embedded.block.importmap'))).toBe(
			true
		)
		expect(bodyHasScope(line, tokens, 'source.js')).toBe(false)
	})
})
