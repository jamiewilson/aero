import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
	collectSnippetModuleEntries,
	renderSnippetsDts,
	writeSnippetTypesGenerated,
} from '../snippet-typegen'

describe('snippet-typegen', () => {
	let tmpDir = ''

	afterEach(() => {
		if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
		tmpDir = ''
	})

	it('collects module specifiers and export names from content/snippets', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-snippet-typegen-'))
		const snippetsDir = path.join(tmpDir, 'content', 'snippets')
		fs.mkdirSync(snippetsDir, { recursive: true })
		fs.writeFileSync(
			path.join(snippetsDir, 'markup.html'),
			`<!-- @snippet:propsString -->
<greeting-component name="Aero" />
`,
			'utf-8'
		)

		const entries = collectSnippetModuleEntries(tmpDir)
		expect(entries).toEqual([
			{
				moduleSpecifier: '@content/snippets/markup.html',
				exportNames: ['propsString'],
			},
		])
	})

	it('renders declare module blocks using Snippet', () => {
		const dts = renderSnippetsDts([
			{ moduleSpecifier: '@content/snippets/markup.html', exportNames: ['propsString', 'typedProps'] },
		])
		expect(dts).toContain("declare module '@content/snippets/markup.html' {")
		expect(dts).toContain('export const propsString: Snippet')
		expect(dts).toContain('export const typedProps: Snippet')
	})

	it('writes snippets.d.ts under .aero/cache/types', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-snippet-typegen-write-'))
		const snippetsDir = path.join(tmpDir, 'content', 'snippets')
		fs.mkdirSync(snippetsDir, { recursive: true })
		fs.writeFileSync(
			path.join(snippetsDir, 'scripts.ts'),
			`// @snippet:drafts
const docs = defineCollection({})
`,
			'utf-8'
		)
		fs.writeFileSync(
			path.join(snippetsDir, 'styles.css'),
			`/* @snippet:card */
.prose { max-width: 65ch; }
`,
			'utf-8'
		)

		const result = writeSnippetTypesGenerated(tmpDir)
		expect(result?.moduleCount).toBe(2)
		const outPath = path.join(tmpDir, '.aero', 'cache', 'types', 'snippets.d.ts')
		expect(fs.existsSync(outPath)).toBe(true)
		const dts = fs.readFileSync(outPath, 'utf-8')
		expect(dts).toContain("declare module '@content/snippets/scripts.ts'")
		expect(dts).toContain("declare module '@content/snippets/styles.css'")
	})
})
