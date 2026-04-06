import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileTemplate } from '@aero-js/compiler'
import { loadCompiledTemplateModule, renderTemplate } from '../standalone'
import { Aero } from '../index'

describe('standalone runtime helpers', () => {
	it('loads compiled module and renders via Aero runtime', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-standalone-'))
		const importer = path.join(dir, 'page.html')
		const source = `<script is:build>const n = 1; const html = '<b>x</b>'</script><h1>{ raw(html) } { n }</h1>`
		const compiled = compileTemplate(source, { root: dir, importer })
		const mod = await loadCompiledTemplateModule({
			compiledSource: compiled,
			root: dir,
			importer,
		})
		const aero = new Aero()
		aero.registerPages({ [importer]: mod })
		const html = await aero.render(importer)
		expect(html).not.toBeNull()
		expect(html).toContain('<b>x</b>')
		expect(html).toContain('1')
	})

	it('one-shot renderTemplate supports imports, slots, loop metadata, and globals', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-standalone-'))
		const componentPath = path.join(dir, 'child.html')
		fs.writeFileSync(
			componentPath,
			`<script is:build>const { title } = Aero.props</script><section><h2>{ title }</h2><slot name="item"></slot><slot></slot></section>`,
			'utf8'
		)
		const importer = path.join(dir, 'page.html')
		const source = `<script is:build>
import child from './child.html'
const items = ['a', 'b']
const itemHtml = '<em>slot</em>'
</script>
<child-component props="{ title: Aero.siteName }">
  <div slot="item">{ itemHtml }</div>
  <ul><li for="{ const item of items }">{ index }/{ length } { item }</li></ul>
</child-component>`
		const html = await renderTemplate({
			templateSource: source,
			root: dir,
			importer,
			globals: { siteName: 'Standalone' },
		})
		expect(html).toContain('<h2>Standalone</h2>')
		expect(html).toContain('&lt;em&gt;slot&lt;/em&gt;')
		expect(html).toContain('0/2 a')
		expect(html).toContain('1/2 b')
	})

	it('supports getStaticPaths in one-shot renderTemplate when params are provided', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-standalone-'))
		const importer = path.join(dir, '[slug].html')
		const source = `<script is:build>
export async function getStaticPaths() {
  return [{ params: { slug: 'hello' }, props: { title: 'Hi' } }]
}
const { title } = Aero.props as { title: string }
</script>
<h1>{ title }</h1>`
		const html = await renderTemplate({
			templateSource: source,
			root: dir,
			importer,
			input: { params: { slug: 'hello' } },
		})
		expect(html).not.toBeNull()
		expect(html).toContain('<h1>Hi</h1>')
	})

	it('throws for missing root/importer requirements', async () => {
		await expect(
			renderTemplate({
				templateSource: '<div>x</div>',
				root: '' as unknown as string,
				importer: '/tmp/page.html',
			})
		).rejects.toThrow('requires `root`')

		await expect(
			loadCompiledTemplateModule({
				compiledSource: 'export default async () => ""',
				root: '/tmp',
				importer: '' as unknown as string,
			})
		).rejects.toThrow('requires `importer`')
	})

	it('throws when component import cannot resolve in standalone mode', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-standalone-'))
		const importer = path.join(dir, 'page.html')
		const source = `<script is:build>import child from './missing.html'</script><child-component />`
		await expect(
			renderTemplate({
				templateSource: source,
				root: dir,
				importer,
			})
		).rejects.toThrow('standalone import resolution failed')
	})
})
