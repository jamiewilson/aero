import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readManifest() {
	const manifestPath = resolve(__dirname, '..', '..', 'package.json')
	return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

describe('vscode manifest', () => {
	it('maps aero language to html emmet by default', () => {
		const manifest = readManifest()
		expect(manifest?.contributes?.configurationDefaults?.['emmet.includeLanguages']).toEqual({
			aero: 'html',
		})
	})
})
