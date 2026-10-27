import { describe, it, expect } from 'vite-plus/test'
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
	it('classifies aero-is scripts', () => {
		const html = `<script is:build>const built = 1</script>
<script is:state>let reactive = 1</script>
<base-layout><p>{ built }</p></base-layout>
`
		const code = new AeroVirtualCode(createSnapshot(html))
		const embeds = (code.embeddedCodes ?? []).map(c => ({ id: c.id, languageId: c.languageId }))
		expect(embeds.some(e => e.id.startsWith('build'))).toBe(true)
		expect(embeds.some(e => e.id.startsWith('state'))).toBe(true)
		expect(embeds.find(e => e.id.startsWith('build'))?.languageId).toBe('typescript')
		expect(embeds.find(e => e.id.startsWith('state'))?.languageId).toBe('typescript')
		expect(embeds.some(e => e.id.startsWith('client'))).toBe(false)
	})
})
