import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { extractTopLevelStyleBodies } from '../template-style-bodies'
import {
	fromAeroStyleVirtualModuleId,
	toAeroStyleInlineImportId,
	toAeroStyleVirtualModuleId,
} from '../defaults'
import { compileHtmlSourceForVite } from '../compile-html-for-vite'

describe('template style virtual modules', () => {
	it('extracts top-level style bodies in order', () => {
		const html = `<div>x</div>
<style>
	.a { color: red; }
</style>
<style>
	.b { color: blue; }
</style>
<p><style>.nested{}</style></p>`
		expect(extractTopLevelStyleBodies(html)).toEqual([
			'\n\t.a { color: red; }\n',
			'\n\t.b { color: blue; }\n',
		])
	})

	it('parses aero style virtual ids', () => {
		const file = '/proj/client/pages/demo.html'
		const id = toAeroStyleInlineImportId(file, 1)
		expect(id).toBe(`\0aero:style:${file}?inline&index=1.css`)
		expect(fromAeroStyleVirtualModuleId(id)).toEqual({ filePath: file, index: 1 })
		expect(fromAeroStyleVirtualModuleId(toAeroStyleVirtualModuleId(file, 0))).toEqual({
			filePath: file,
			index: 0,
		})
	})

	it('compileHtmlSourceForVite imports inline style modules', () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-style-compile-'))
		const filePath = path.join(tmp, 'page.html')
		const html = `<p>hi</p>
<style>
	@reference 'tailwindcss';
	@utility demo { @apply font-mono; }
</style>`
		fs.writeFileSync(filePath, html, 'utf-8')
		const { code } = compileHtmlSourceForVite(
			html,
			filePath,
			{
				resolvedConfig: { root: tmp } as any,
				resolvePath: (id: string) => id,
			},
			new Map()
		)
		expect(code).toContain('import __aero_css_0 from')
		expect(code).toContain('?inline&index=0.css')
		expect(code).toContain('__aero_style_0 += __aero_css_0')
		expect(code).not.toContain('@utility demo')
		expect(code).not.toContain('@reference')
	})
})
