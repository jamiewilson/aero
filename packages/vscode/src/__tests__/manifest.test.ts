import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readManifest() {
	const manifestPath = resolve(__dirname, '..', '..', 'package.json')
	return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

describe('vscode manifest', () => {
	it('does not contribute a custom aero language or aero formatter defaults', () => {
		const manifest = readManifest()
		expect(manifest?.contributes?.languages).toBeUndefined()
		expect(manifest?.contributes?.configurationDefaults?.['emmet.includeLanguages']).toBeUndefined()
		expect(manifest?.contributes?.configurationDefaults?.['[aero]']).toBeUndefined()
		const grammars = manifest?.contributes?.grammars ?? []
		expect(grammars.some((g: { language?: string }) => g.language === 'aero')).toBe(false)
		expect(grammars.some((g: { scopeName?: string }) => g.scopeName === 'text.html.aero')).toBe(false)
	})

	it('disables built-in HTML script validation so TypeScript in is:build/is:state is not flagged as JS', () => {
		const manifest = readManifest()
		expect(manifest?.contributes?.configurationDefaults?.['html.validate.scripts']).toBe(false)
	})

	it('recommends prettier-vscode and injects aero-scripts into native HTML', () => {
		const manifest = readManifest()
		expect(manifest?.extensionRecommendations).toContain('esbenp.prettier-vscode')
		const scripts = manifest?.contributes?.grammars?.find(
			(g: { scopeName?: string }) => g.scopeName === 'aero.scripts.injection'
		)
		expect(scripts?.injectTo).toEqual(['text.html.basic', 'text.html'])
		expect(scripts?.embeddedLanguages?.['source.ts']).toBe('typescript')
	})
})
