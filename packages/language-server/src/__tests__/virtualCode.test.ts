import { describe, it, expect } from 'vitest'
import { AeroVirtualCode } from '../virtualCode'
import type { IScriptSnapshot } from '@volar/language-core'

function createSnapshot(text: string): IScriptSnapshot {
	return {
		getText: (start: number, end: number) => text.substring(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	}
}

function getEmbeddedById(code: AeroVirtualCode, id: string) {
	return code.embeddedCodes?.find(c => c.id === id)
}

function getEmbeddedText(code: AeroVirtualCode, id: string) {
	const embedded = getEmbeddedById(code, id)
	if (!embedded) return undefined
	return embedded.snapshot.getText(0, embedded.snapshot.getLength())
}

describe('AeroVirtualCode', () => {
	it('extracts build script as typescript virtual code', () => {
		const html = `<script is:build>
const { title } = aero.props
</script>
<h1>{ title }</h1>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')

		expect(build).toBeDefined()
		expect(build!.languageId).toBe('typescript')

		const text = getEmbeddedText(code, 'build_0')!
		expect(text).toContain('declare const aero')
		expect(text).toContain('const { title } = aero.props')
	})

	it('includes ambient preamble before build script content', () => {
		const html = `<script is:build>
const x = 1
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const text = getEmbeddedText(code, 'build_0')!

		expect(text).toContain('declare const aero:')
		expect(text).toContain('declare const Aero:')
		expect(text).toContain('declare function renderComponent(')
		expect(text).toContain("declare module '*.html'")
		const preambleEnd = text.indexOf('const x = 1')
		expect(preambleEnd).toBeGreaterThan(0)
	})

	it('maps build script offsets correctly', () => {
		const scriptContent = '\nconst { title } = aero.props\n'
		const html = `<script is:build>${scriptContent}</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')!

		const mapping = build.mappings[0]
		expect(mapping.sourceOffsets[0]).toBe('<script is:build>'.length)
		expect(mapping.lengths[0]).toBe(scriptContent.length)

		const virtualText = build.snapshot.getText(0, build.snapshot.getLength())
		const mappedContent = virtualText.substring(
			mapping.generatedOffsets[0],
			mapping.generatedOffsets[0] + mapping.lengths[0],
		)
		expect(mappedContent).toBe(scriptContent)
	})

	it('extracts client script as typescript virtual code', () => {
		const html = `<script>
document.querySelector('.btn')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const client = getEmbeddedById(code, 'client_0')

		expect(client).toBeDefined()
		expect(client!.languageId).toBe('typescript')

		const text = getEmbeddedText(code, 'client_0')!
		expect(text).toContain("document.querySelector('.btn')")
		expect(text).not.toContain('declare const aero')
	})

	it('extracts blocking script as typescript virtual code', () => {
		const html = `<script is:blocking>
const theme = localStorage.getItem('theme')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const blocking = getEmbeddedById(code, 'blocking_0')

		expect(blocking).toBeDefined()
		expect(blocking!.languageId).toBe('typescript')
	})

	it('ignores inline scripts', () => {
		const html = `<script is:inline>
alert('hello')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(code.embeddedCodes?.filter(c => c.id !== 'ambient').length).toBe(0)
	})

	it('ignores pass:data scripts', () => {
		const html = `<script pass:data="{ storageKey }">
const theme = JSON.parse(localStorage.getItem(storageKey))
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(code.embeddedCodes?.filter(c => c.id !== 'ambient').length).toBe(0)
	})

	it('ignores external scripts', () => {
		const html = `<script src="https://cdn.example.com/lib.js"></script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(code.embeddedCodes?.filter(c => c.id !== 'ambient').length).toBe(0)
	})

	it('extracts style blocks as CSS virtual code', () => {
		const html = `<style>
body { margin: 0; }
</style>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const style = getEmbeddedById(code, 'style_0')

		expect(style).toBeDefined()
		expect(style!.languageId).toBe('css')

		const text = getEmbeddedText(code, 'style_0')!
		expect(text).toContain('body { margin: 0; }')
	})

	it('extracts multiple script blocks with unique IDs', () => {
		const html = `<script is:build>
const { title } = aero.props
</script>
<script>
console.log('client 1')
</script>
<script>
console.log('client 2')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(getEmbeddedById(code, 'build_0')).toBeDefined()
		expect(getEmbeddedById(code, 'client_0')).toBeDefined()
		expect(getEmbeddedById(code, 'client_1')).toBeDefined()
	})

	it('skips empty script blocks', () => {
		const html = `<script is:build></script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(code.embeddedCodes?.filter(c => c.id !== 'ambient').length).toBe(0)
	})

	it('root virtual code has HTML language ID', () => {
		const html = `<div>hello</div>`
		const code = new AeroVirtualCode(createSnapshot(html))

		expect(code.id).toBe('root')
		expect(code.languageId).toBe('html')
	})

	it('root mappings cover entire document', () => {
		const html = `<h1>hello</h1>`
		const code = new AeroVirtualCode(createSnapshot(html))

		expect(code.mappings).toHaveLength(1)
		expect(code.mappings[0].sourceOffsets[0]).toBe(0)
		expect(code.mappings[0].lengths[0]).toBe(html.length)
	})
})
