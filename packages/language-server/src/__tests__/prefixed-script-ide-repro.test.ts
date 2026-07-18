import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { AeroVirtualCode } from '../virtualCode'
import type { IScriptSnapshot } from '@volar/language-core'

function createSnapshot(text: string): IScriptSnapshot {
	return {
		getText: (start: number, end: number) => text.substring(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	}
}

describe('prefixed script IDE repro', () => {
	it('classifies aero-is scripts', async () => {
		const htmlPath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../../../examples/kitchen-sink/client/pages/demos/iterables.html'
		)
		const html = readFileSync(htmlPath, 'utf8')
		const code = new AeroVirtualCode(createSnapshot(html))
		const embeds = (code.embeddedCodes ?? []).map(c => ({ id: c.id, languageId: c.languageId }))
		console.log('EMBEDS', JSON.stringify(embeds))
		expect(embeds.some(e => e.id.startsWith('build'))).toBe(true)
		expect(embeds.some(e => e.id.startsWith('state'))).toBe(true)
		expect(embeds.find(e => e.id.startsWith('build'))?.languageId).toBe('typescript')
		expect(embeds.find(e => e.id.startsWith('state'))?.languageId).toBe('typescript')
		expect(embeds.some(e => e.id.startsWith('client'))).toBe(false)
		await new Promise(r => setTimeout(r, 300))
	})
})
