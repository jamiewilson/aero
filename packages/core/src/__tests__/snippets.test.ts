import { describe, expect, it } from 'vitest'
import {
	compileSnippetModule,
	isSnippetModulePath,
	parseSnippetModule,
	snippetIdToExportName,
	SnippetModuleError,
	SNIPPETS_SOURCE_REL,
} from '../snippets'

describe('isSnippetModulePath', () => {
	it('matches any file under content/snippets', () => {
		expect(isSnippetModulePath('/app/content/snippets/markup.html')).toBe(true)
		expect(isSnippetModulePath('/app/content/snippets/scripts.ts')).toBe(true)
		expect(isSnippetModulePath('/app/content/snippets/styles.css')).toBe(true)
		expect(isSnippetModulePath('/app/content/snippets/readme.md')).toBe(true)
		expect(isSnippetModulePath('/app/content/snippets/Dockerfile')).toBe(true)
	})

	it('rejects paths outside content/snippets', () => {
		expect(isSnippetModulePath('/app/client/components/card.html')).toBe(false)
		expect(isSnippetModulePath('/app/client/components/_snippets/markup.html')).toBe(false)
	})

	it('exports the snippets source path segment', () => {
		expect(SNIPPETS_SOURCE_REL).toBe('content/snippets')
	})
})

describe('snippetIdToExportName', () => {
	it('passes through camelCase ids', () => {
		expect(snippetIdToExportName('propsString')).toBe('propsString')
	})

	it('converts kebab-case to camelCase', () => {
		expect(snippetIdToExportName('second-snippet')).toBe('secondSnippet')
	})
})

describe('parseSnippetModule', () => {
	const htmlPath = '/app/content/snippets/markup.html'

	it('extracts html snippets between markers', () => {
		const source = `<!-- @snippet:propsString -->
<greeting-component name="Aero" />

<!-- @snippet:expressionProp -->
<greeting-component name="{ expressionTitle }" />
`
		const snippets = parseSnippetModule(source, htmlPath)
		expect(snippets.get('propsString')).toEqual({
			code: '<greeting-component name="Aero" />',
			lang: 'html',
		})
		expect(snippets.get('expressionProp')).toEqual({
			code: '<greeting-component name="{ expressionTitle }" />',
			lang: 'html',
		})
	})

	it('parses ts line-comment markers', () => {
		const source = `// @snippet:drafts
const docs = defineCollection({})
`
		const snippets = parseSnippetModule(source, '/app/content/snippets/scripts.ts')
		expect(snippets.get('drafts')).toEqual({
			code: 'const docs = defineCollection({})',
			lang: 'ts',
		})
	})

	it('parses css block-comment markers', () => {
		const source = `/* @snippet:card */
.prose {
  max-width: 65ch;
}
`
		const snippets = parseSnippetModule(source, '/app/content/snippets/styles.css')
		expect(snippets.get('card')).toEqual({
			code: '.prose {\n  max-width: 65ch;\n}',
			lang: 'css',
		})
	})

	it('parses yaml hash-comment markers', () => {
		const source = `# @snippet:site
title: Aero
url: https://example.com
`
		const snippets = parseSnippetModule(source, '/app/content/snippets/config.yaml')
		expect(snippets.get('site')).toEqual({
			code: 'title: Aero\nurl: https://example.com',
			lang: 'yaml',
		})
	})

	it('throws on duplicate ids', () => {
		const source = `<!-- @snippet:dup -->
a
<!-- @snippet:dup -->
b
`
		expect(() => parseSnippetModule(source, htmlPath)).toThrow(SnippetModuleError)
	})

	it('throws on empty body', () => {
		const source = `<!-- @snippet:empty -->
<!-- @snippet:next -->
body
`
		expect(() => parseSnippetModule(source, htmlPath)).toThrow(SnippetModuleError)
	})

	it('throws when file has no markers', () => {
		expect(() => parseSnippetModule('<p>plain</p>', htmlPath)).toThrow(SnippetModuleError)
	})
})

describe('compileSnippetModule', () => {
	it('emits const exports with code and lang', () => {
		const source = `<!-- @snippet:propsString -->
<greeting-component name="Aero" />
`
		const code = compileSnippetModule(source, '/app/content/snippets/markup.html')
		expect(code).toContain('export const propsString = { code: "<greeting-component name=\\"Aero\\" />", lang: "html" }')
		expect(code).not.toContain('as const')
	})
})
