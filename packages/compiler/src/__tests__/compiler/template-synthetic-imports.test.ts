import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { parse } from '../../parser'
import { compile } from '../../codegen'
import { buildTemplateTagIndex } from '../../template-tag-index'

function mkTmp(prefix: string): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function clientDirs(root: string): { componentsDir: string; layoutsDir: string } {
	const componentsDir = path.join(root, 'client', 'components')
	const layoutsDir = path.join(root, 'client', 'layouts')
	fs.mkdirSync(componentsDir, { recursive: true })
	fs.mkdirSync(layoutsDir, { recursive: true })
	return { componentsDir, layoutsDir }
}

describe('synthetic template imports', () => {
	it('emits dynamic import for footer-component without author import', () => {
		const tmp = mkTmp('aero-synth-')
		const { componentsDir, layoutsDir } = clientDirs(tmp)
		fs.writeFileSync(
			path.join(componentsDir, 'footer.html'),
			`<script is:build></script><footer>ok</footer>`
		)
		const importer = path.join(tmp, 'client', 'pages', 'home.html')
		fs.mkdirSync(path.dirname(importer), { recursive: true })

		const html = `<footer-component />`
		const code = compile(parse(html), {
			root: tmp,
			importer,
			resolvePath: (specifier, from) => {
				if (specifier.startsWith('@components/')) {
					return path.join(componentsDir, specifier.slice('@components/'.length))
				}
				return path.resolve(path.dirname(from), specifier)
			},
			componentsDir,
			layoutsDir,
			templateAutoImport: true,
		})

		expect(code).toContain('await import(')
		expect(code).toContain('const footer =')
		expect(code).toContain('renderComponent(footer')
	})

	it('keeps author import specifier when binding matches tag', () => {
		const tmp = mkTmp('aero-synth-author-')
		const { componentsDir, layoutsDir } = clientDirs(tmp)
		const customPath = path.join(tmp, 'custom-footer.html')
		fs.writeFileSync(customPath, `<script is:build></script><footer>custom</footer>`)
		fs.writeFileSync(
			path.join(componentsDir, 'footer.html'),
			`<script is:build></script><footer>default</footer>`
		)
		const importer = path.join(tmp, 'page.html')

		const html = `<script is:build>
import footer from './custom-footer.html'
</script>
<footer-component />`
		const code = compile(parse(html), {
			root: tmp,
			importer,
			resolvePath: (specifier, from) => path.resolve(path.dirname(from), specifier),
			componentsDir,
			layoutsDir,
			templateAutoImport: true,
		})

		expect(code).toContain('custom-footer.html')
		expect(code.match(/await import/g)?.length).toBe(1)
	})

	it('throws CompileError for ambiguous component basename', () => {
		const tmp = mkTmp('aero-synth-ambig-')
		const { componentsDir, layoutsDir } = clientDirs(tmp)
		fs.mkdirSync(path.join(componentsDir, 'a'), { recursive: true })
		fs.mkdirSync(path.join(componentsDir, 'b'), { recursive: true })
		fs.writeFileSync(path.join(componentsDir, 'a', 'toggle.html'), '<a></a>')
		fs.writeFileSync(path.join(componentsDir, 'b', 'toggle.html'), '<b></b>')

		expect(() =>
			compile(parse('<toggle-component />'), {
				root: tmp,
				importer: path.join(tmp, 'page.html'),
				resolvePath: s => s,
				componentsDir,
				layoutsDir,
				templateAutoImport: true,
			})
		).toThrow(/ambiguous/i)
	})

	it('skips synthetic imports when templateAutoImport is false', () => {
		const tmp = mkTmp('aero-synth-off-')
		const { componentsDir, layoutsDir } = clientDirs(tmp)
		fs.writeFileSync(path.join(componentsDir, 'footer.html'), '<footer></footer>')

		const code = compile(parse('<footer-component />'), {
			root: tmp,
			importer: path.join(tmp, 'page.html'),
			resolvePath: s => s,
			componentsDir,
			layoutsDir,
			templateAutoImport: false,
		})

		expect(code).not.toContain('await import(')
	})

	it('accepts a prebuilt templateTagIndex', () => {
		const tmp = mkTmp('aero-synth-index-')
		const { componentsDir, layoutsDir } = clientDirs(tmp)
		fs.writeFileSync(path.join(componentsDir, 'badge.html'), '<span></span>')
		const index = buildTemplateTagIndex({ componentsDir, layoutsDir })

		const code = compile(parse('<badge-component />'), {
			root: tmp,
			importer: path.join(tmp, 'page.html'),
			resolvePath: s => s,
			templateTagIndex: index,
			templateAutoImport: true,
		})

		expect(code).toContain('const badge =')
	})
})
