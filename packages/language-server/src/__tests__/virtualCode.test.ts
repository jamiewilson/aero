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

	it('injects interface declarations from build script before declare const in expression virtual TS', () => {
		const html = `<script is:build lang="ts">
interface PageProps { title: string }
const { title } = Aero.props as PageProps
</script>
<div>{ title }</div>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain('interface PageProps')
		expect(expr0.indexOf('interface PageProps')).toBeLessThan(expr0.indexOf('declare const title'))
		expect(expr0).toMatch(/declare const title: string;/)
	})

	it('injects build-scope declare const bindings before template { } expression TS', () => {
		const html = `<script is:build>
const isHomepage = Aero.page.url.pathname === '/'
const props = Aero.props as { x: number }
</script>
<div>{ isHomepage } { props.x }</div>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toMatch(/declare const isHomepage: boolean;/)
		expect(expr0).toContain('declare const props:')
		const expr0Body = ' isHomepage '
		expect(expr0.indexOf('declare const isHomepage')).toBeLessThan(expr0.indexOf(expr0Body))

		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toMatch(/declare const props: \{[^}]*x: number/)
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

	it('injects for-directive loop variable into interpolation virtual fragments', () => {
		const html = `<ul><li data-for="{ const doc of docs }"><span>{ doc.id }</span><span>{ doc.data.title }</span></li></ul>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain('declare const doc: any;')
		expect(expr0).toContain(' doc.id ')

		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toContain('declare const doc: any;')
		expect(expr1).toContain(' doc.data.title ')
	})

	it('injects destructured for-directive bindings into interpolation virtual fragments', () => {
		const html = `<li for="{ const { path, label } of links }"><span>{ path }</span><span>{ label }</span></li>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain('declare const path: any;')
		expect(expr0).toContain(' path ')

		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toContain('declare const label: any;')
		expect(expr1).toContain(' label ')
	})

	it('injects implicit for-loop variables (index, first, last, length)', () => {
		const html = `<li for="{ const item of items }">{ index } { first } { last } { length }</li>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain('declare const index: any;')
		expect(expr0).toContain('declare const first: any;')
		expect(expr0).toContain('declare const last: any;')
		expect(expr0).toContain('declare const length: any;')
		expect(expr0).toContain('declare const item: any;')
	})

	it('handles nested for-directives with both scopes available', () => {
		const html = `<ul for="{ const group of groups }"><li for="{ const item of group.items }">{ group.name } { item.label }</li></ul>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain('declare const group: any;')
		expect(expr0).toContain('declare const item: any;')
		expect(expr0).toContain(' group.name ')

		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toContain('declare const group: any;')
		expect(expr1).toContain('declare const item: any;')
		expect(expr1).toContain(' item.label ')
	})

	it('does not create interpolation virtual fragment for the for-directive attribute value itself', () => {
		const html = `<li for="{ const item of items }">{ item.name }</li>`

		const code = new AeroVirtualCode(createSnapshot(html))
		// Only the template expression should produce a virtual fragment, not the for-directive value
		const allExprs = code.embeddedCodes?.filter(c => c.id.startsWith('expr_')) ?? []
		expect(allExprs).toHaveLength(1)
		const text = getEmbeddedText(code, 'expr_0')!
		expect(text).toContain(' item.name ')
	})

	it('extracts interpolations from attribute values', () => {
		const html = `<a href="/docs/{ slug }">link</a>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain(' slug ')
	})

	it('extracts multiple interpolations from a single attribute value', () => {
		const html = `<a href="{ base }/{ path }">link</a>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain(' base ')
		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toContain(' path ')
	})

	it('extracts mixed attribute and text-content interpolations', () => {
		const html = `<a href="/docs/{ slug }">{ title }</a>`

		const code = new AeroVirtualCode(createSnapshot(html))
		// expr_0 is from the attribute (pass 1), expr_1 from text content (pass 2)
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain(' slug ')
		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toContain(' title ')
	})

	it('injects for-directive bindings into attribute interpolation fragments', () => {
		const html = `<li data-for="{ const doc of docs }"><a href="{ doc.path }">{ doc.title }</a></li>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain('declare const doc: any;')
		expect(expr0).toContain(' doc.path ')
		const expr1 = getEmbeddedText(code, 'expr_1')!
		expect(expr1).toContain('declare const doc: any;')
		expect(expr1).toContain(' doc.title ')
	})

	it('injects build-scope bindings into attribute interpolation fragments', () => {
		const html = `<script is:build>const base = '/docs'</script><a href="{ base }/page">link</a>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toMatch(/declare const base: "\/docs";/)
		expect(expr0).toContain(' base ')
	})

	it('does not extract interpolations from Alpine directive attributes', () => {
		const html = `<div x-bind:class="{ foo }">{ bar }</div>`

		const code = new AeroVirtualCode(createSnapshot(html))
		// Only one expression: the text content { bar }
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain(' bar ')
		expect(getEmbeddedById(code, 'expr_1')).toBeUndefined()
	})

	it('treats {{ }} as literal braces in attribute values (no interpolation)', () => {
		const html = `<div data-value="{{ not interpolated }}">{ real }</div>`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		expect(expr0).toContain(' real ')
		expect(getEmbeddedById(code, 'expr_1')).toBeUndefined()
	})

	it('wraps props attribute spreads in object-then-array context for valid object spread', () => {
		const html = `<meta-component props="{ ...Aero.props }" />`

		const code = new AeroVirtualCode(createSnapshot(html))
		const expr0 = getEmbeddedText(code, 'expr_0')!
		// Inner `{ ...Aero.props }` becomes `[{ ...Aero.props }]` (not `[...Aero.props]`, which needs an iterable)
		expect(expr0).toContain('[{')
		expect(expr0).toContain('...Aero.props')
		expect(expr0).toContain('}]')
	})
})
