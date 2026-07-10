import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: resolve('/Users/jamie/dev/aero/examples/kitchen-sink'),
	resolvePath: (v: string, _importer: string) => v,
	importer: '/Users/jamie/dev/aero/examples/kitchen-sink/client/pages/demos/numeric-text.html',
}

describe('code snippet interpolation repro', () => {
	const cases = [
		{ name: 'numeric-text', snippet: '<numeric-text />' },
		{ name: 'sub-layout', snippet: '<sub-layout />' },
		{ name: 'slot', snippet: '<slot name="into-nav" />' },
	] as const

	for (const { name, snippet } of cases) {
		it(`preserves literal ${name} snippet in code element`, () => {
			const html = `<script is:build></script><code>{ \`${snippet}\` }</code>`
			const parsed = parse(html)
			const codeEl = parsed.template.match(/<code>[\s\S]*?<\/code>/)?.[0] ?? ''
			expect(codeEl, 'parsed template').toContain(snippet)
			expect(codeEl, 'parsed template').not.toContain('&lt;')
			const code = compile(parsed, mockOptions)
			expect(code, 'compiled output').toContain(snippet.replace('<', ''))
		})
	}

	it('preserves numeric-text snippet in full demo page', () => {
		const html = readFileSync(
			resolve('/Users/jamie/dev/aero/examples/kitchen-sink/client/pages/demos/numeric-text.html'),
			'utf8'
		)
		const parsed = parse(html)
		const codeEls = [...parsed.template.matchAll(/<code>([\s\S]*?)<\/code>/g)].map(m => m[0])
		const snippet = codeEls.find(e => e.includes('numeric-text') && e.includes('{'))
		expect(snippet, codeEls.join('\n')).toContain('<numeric-text />')
		expect(snippet).not.toContain('&lt;numeric-text')

		const code = compile(parsed, mockOptions)
		expect(code).not.toContain('data-aero-text="0"')
		expect(code).not.toContain('__aeroTextRead_0')
	})

	it('emits static snippet without reactive text bind on numeric-text demo', () => {
		const html = readFileSync(
			resolve('/Users/jamie/dev/aero/examples/kitchen-sink/client/pages/demos/numeric-text.html'),
			'utf8'
		)
		const code = compile(parse(html), mockOptions)
		expect(code).toContain('${escapeHtml( `<numeric-text />` )}')
		expect(code).not.toContain('data-aero-text="0"')
		expect(code).toContain('textBinds: []')
	})
})
