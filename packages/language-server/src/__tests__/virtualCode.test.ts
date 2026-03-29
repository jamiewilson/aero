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
	it('extracts build script as typescript virtual code when lang="ts"', () => {
		const html = `<script is:build lang="ts">
const { title } = Aero.props
</script>
<h1>{ title }</h1>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')

		expect(build).toBeDefined()
		expect(build!.languageId).toBe('typescript')

		const text = getEmbeddedText(code, 'build_0')!
		expect(text).toContain('declare const Aero')
		expect(text).toContain('const { title } = Aero.props')
	})

	it('injects build-scope declare const bindings before template { } expression TS', () => {
		const html = `<script is:build>
const isHomepage = Aero.page.url.pathname === '/'
const props = Aero.props as { x: number }
</script>
<div>{ isHomepage } { props.x }</div>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain('declare const isHomepage: any;')
		expect(expr0).toContain('declare const props: any;')
		const expr0Body = ' isHomepage '
		expect(expr0.indexOf('declare const isHomepage')).toBeLessThan(expr0.indexOf(expr0Body))

		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toContain('declare const props: any;')
		expect(expr1).toContain(' props.x ')
		expect(expr1.indexOf('declare const props')).toBeLessThan(expr1.indexOf(' props.x '))
	})

	it('includes ambient preamble before build script content', () => {
		const html = `<script is:build lang="ts">
const x = 1
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const text = getEmbeddedText(code, 'build_0')!

		expect(text).toContain('declare const Aero:')
		expect(text).toContain('declare function renderComponent(')
		expect(text).toContain("declare module '*.html'")
		const preambleEnd = text.indexOf('const x = 1')
		expect(preambleEnd).toBeGreaterThan(0)
	})

	it('maps build script offsets correctly', () => {
		const scriptContent = '\nconst { title } = Aero.props\n'
		const html = `<script is:build lang="ts">${scriptContent}</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')!

		const mapping = build.mappings[0]
		expect(mapping.sourceOffsets[0]).toBe('<script is:build lang="ts">'.length)
		expect(mapping.lengths[0]).toBe(scriptContent.length)

		const virtualText = build.snapshot.getText(0, build.snapshot.getLength())
		const mappedContent = virtualText.substring(
			mapping.generatedOffsets[0],
			mapping.generatedOffsets[0] + mapping.lengths[0]
		)
		expect(mappedContent).toBe(scriptContent)
	})

	it('extracts client script as typescript virtual code when lang="ts"', () => {
		const html = `<script lang="ts">
document.querySelector('.btn')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const client = getEmbeddedById(code, 'client_0')

		expect(client).toBeDefined()
		expect(client!.languageId).toBe('typescript')

		const text = getEmbeddedText(code, 'client_0')!
		expect(text).toContain("document.querySelector('.btn')")
		expect(text).not.toContain('declare const Aero')
	})

	it('extracts blocking script as typescript virtual code when lang="ts"', () => {
		const html = `<script is:blocking lang="ts">
const theme = localStorage.getItem('theme')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const blocking = getEmbeddedById(code, 'blocking_0')

		expect(blocking).toBeDefined()
		expect(blocking!.languageId).toBe('typescript')
	})

	it('extracts inline scripts as javascript when no lang', () => {
		const html = `<script is:inline>
alert('hello')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const inline = getEmbeddedById(code, 'inline_0')
		expect(inline).toBeDefined()
		expect(inline!.languageId).toBe('javascript')
		expect(getEmbeddedText(code, 'inline_0')).toContain("alert('hello')")
	})

	it('extracts props scripts as embedded JS/TS like inline', () => {
		const html = `<script props="{ storageKey }">
const theme = JSON.parse(localStorage.getItem(storageKey))
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const inline = getEmbeddedById(code, 'inline_0')
		expect(inline).toBeDefined()
		expect(inline!.languageId).toBe('javascript')
	})

	it('extracts inline script as typescript when lang="ts"', () => {
		const html = `<script is:inline lang="ts">
const x: number = 1
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const inline = getEmbeddedById(code, 'inline_0')
		expect(inline).toBeDefined()
		expect(inline!.languageId).toBe('typescript')
	})

	it('ignores external scripts', () => {
		const html = `<script src="https://cdn.example.com/lib.js"></script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(code.embeddedCodes?.filter(c => c.id !== 'ambient').length).toBe(0)
	})

	it('ignores importmap scripts', () => {
		const html = `<script type="importmap">
{"imports":{"htmx.org":"https://unpkg.com/htmx.org@2.0.8/dist/htmx.esm.js"}}
</script>`

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
		const html = `<script is:build lang="ts">
const { title } = Aero.props
</script>
<script lang="ts">
console.log('client 1')
</script>
<script lang="ts">
console.log('client 2')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(getEmbeddedById(code, 'build_0')).toBeDefined()
		expect(getEmbeddedById(code, 'client_0')).toBeDefined()
		expect(getEmbeddedById(code, 'client_1')).toBeDefined()
	})

	it('skips empty script blocks', () => {
		const html = `<script is:build lang="ts"></script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(code.embeddedCodes?.filter(c => c.id !== 'ambient').length).toBe(0)
	})

	it('extracts build script without lang as typescript (default)', () => {
		const html = `<script is:build>
const x = 1
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')
		expect(build).toBeDefined()
		expect(build!.languageId).toBe('typescript')
		const text = getEmbeddedText(code, 'build_0')!
		expect(text).toContain('const x = 1')
		expect(text).toContain('declare const Aero')
	})

	it('extracts build script with lang="js" as javascript', () => {
		const html = `<script is:build lang="js">
const x = 1
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')
		expect(build).toBeDefined()
		expect(build!.languageId).toBe('javascript')
		expect(getEmbeddedText(code, 'build_0')).not.toContain('declare const Aero')
	})

	it('extracts build script with lang="javascript" as javascript', () => {
		const html = `<script is:build lang="javascript">
const x = 1
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')
		expect(build).toBeDefined()
		expect(build!.languageId).toBe('javascript')
		expect(getEmbeddedText(code, 'build_0')).not.toContain('declare const Aero')
	})

	it('extracts client script without lang="ts" as javascript', () => {
		const html = `<script>
console.log('client')
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const client = getEmbeddedById(code, 'client_0')
		expect(client).toBeDefined()
		expect(client!.languageId).toBe('javascript')
		expect(getEmbeddedText(code, 'client_0')).toContain("console.log('client')")
	})

	it('accepts lang="typescript"', () => {
		const html = `<script is:build lang="typescript">
const x = 1
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const build = getEmbeddedById(code, 'build_0')
		expect(build).toBeDefined()
		expect(build!.languageId).toBe('typescript')
		expect(getEmbeddedText(code, 'build_0')).toContain('const x = 1')
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

	it('extracts template { } interpolations as typescript virtual fragments', () => {
		const html = `<h1>{ title }</h1>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr = getEmbeddedById(code, 'expr_0')
		expect(expr).toBeDefined()
		expect(expr!.languageId).toBe('typescript')
		const text = getEmbeddedText(code, 'expr_0')!
		expect(text).toContain('declare const Aero')
		expect(text).toContain('title')
	})

	it('does not treat braces inside script bodies as template interpolations', () => {
		const html = `<script is:build>
const o = { a: 1 }
</script>`

		const code = new AeroVirtualCode(createSnapshot(html))
		expect(getEmbeddedById(code, 'expr_0')).toBeUndefined()
	})
})
