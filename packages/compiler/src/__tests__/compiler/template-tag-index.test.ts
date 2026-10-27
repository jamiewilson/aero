import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { walkHtmlFiles, walkHtmlFilesDirectOnly } from '../../fs-walk'
import {
	buildTemplateTagIndex,
	buildTemplateTagIndexFromPaths,
	formatResolveTemplateTagError,
	resolveTemplateTag,
} from '../../template-tag-index'

function mkTmp(prefix: string): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

describe('template-tag-index', () => {
	const tmpDirs: string[] = []
	afterEach(() => {
		for (const dir of tmpDirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})

	function clientTree(root: string): { componentsDir: string; layoutsDir: string } {
		const componentsDir = path.join(root, 'client', 'components')
		const layoutsDir = path.join(root, 'client', 'layouts')
		fs.mkdirSync(componentsDir, { recursive: true })
		fs.mkdirSync(layoutsDir, { recursive: true })
		return { componentsDir, layoutsDir }
	}

	it('indexes footer component with alias specifier', () => {
		const tmp = mkTmp('aero-tti-')
		tmpDirs.push(tmp)
		const { componentsDir, layoutsDir } = clientTree(tmp)
		fs.writeFileSync(path.join(componentsDir, 'footer.html'), '<footer></footer>')

		const index = buildTemplateTagIndex({ componentsDir, layoutsDir })
		const result = resolveTemplateTag(index, 'component', 'footer')

		expect(result.status).toBe('ok')
		if (result.status !== 'ok') return
		expect(result.entry.specifier).toBe('@components/footer.html')
		expect(result.entry.binding).toBe('footer')
		expect(result.entry.tagBase).toBe('footer')
	})

	it('indexes nested theme/toggle.html', () => {
		const tmp = mkTmp('aero-tti-nest-')
		tmpDirs.push(tmp)
		const { componentsDir, layoutsDir } = clientTree(tmp)
		fs.mkdirSync(path.join(componentsDir, 'theme'), { recursive: true })
		fs.writeFileSync(path.join(componentsDir, 'theme', 'toggle.html'), '<button></button>')

		const index = buildTemplateTagIndex({ componentsDir, layoutsDir })
		const result = resolveTemplateTag(index, 'component', 'toggle')

		expect(result.status).toBe('ok')
		if (result.status !== 'ok') return
		expect(result.entry.specifier).toBe('@components/theme/toggle.html')
		expect(result.entry.binding).toBe('toggle')
	})

	it('returns ambiguous when two toggle.html files exist', () => {
		const tmp = mkTmp('aero-tti-dup-')
		tmpDirs.push(tmp)
		const { componentsDir, layoutsDir } = clientTree(tmp)
		fs.mkdirSync(path.join(componentsDir, 'theme'), { recursive: true })
		fs.mkdirSync(path.join(componentsDir, 'other'), { recursive: true })
		fs.writeFileSync(path.join(componentsDir, 'theme', 'toggle.html'), '<a></a>')
		fs.writeFileSync(path.join(componentsDir, 'other', 'toggle.html'), '<b></b>')

		const index = buildTemplateTagIndex({ componentsDir, layoutsDir })
		const result = resolveTemplateTag(index, 'component', 'toggle')

		expect(result.status).toBe('ambiguous')
		if (result.status !== 'ambiguous') return
		expect(result.candidates).toHaveLength(2)
		const specifiers = result.candidates.map(c => c.specifier).sort()
		expect(specifiers).toEqual(['@components/other/toggle.html', '@components/theme/toggle.html'])
		expect(formatResolveTemplateTagError(result)).toContain('toggle')
		expect(formatResolveTemplateTagError(result)).toContain('ambiguous')
	})

	it('indexes layouts direct-only and ignores nested layout html', () => {
		const tmp = mkTmp('aero-tti-layout-')
		tmpDirs.push(tmp)
		const { componentsDir, layoutsDir } = clientTree(tmp)
		fs.mkdirSync(path.join(layoutsDir, 'nested'), { recursive: true })
		fs.writeFileSync(path.join(layoutsDir, 'base.html'), '<html></html>')
		fs.writeFileSync(path.join(layoutsDir, 'nested', 'sub.html'), '<html></html>')

		const index = buildTemplateTagIndex({ componentsDir, layoutsDir })

		expect(resolveTemplateTag(index, 'layout', 'base').status).toBe('ok')
		expect(resolveTemplateTag(index, 'layout', 'sub').status).toBe('missing')
	})

	it('returns missing for unknown tag base', () => {
		const tmp = mkTmp('aero-tti-miss-')
		tmpDirs.push(tmp)
		const { componentsDir, layoutsDir } = clientTree(tmp)
		const index = buildTemplateTagIndex({ componentsDir, layoutsDir })
		const result = resolveTemplateTag(index, 'component', 'missing')

		expect(result.status).toBe('missing')
		if (result.status !== 'missing') return
		expect(formatResolveTemplateTagError(result)).toContain('missing')
	})

	it('walk rules match runtime discovery (components recursive, layouts direct-only)', () => {
		const tmp = mkTmp('aero-tti-walk-')
		tmpDirs.push(tmp)
		const clientRoot = path.join(tmp, 'client')
		fs.mkdirSync(path.join(clientRoot, 'components', 'nest'), { recursive: true })
		fs.writeFileSync(path.join(clientRoot, 'components', 'a.html'), '<html></html>')
		fs.writeFileSync(path.join(clientRoot, 'components', 'nest', 'b.html'), '<html></html>')
		fs.mkdirSync(path.join(clientRoot, 'layouts', 'sub'), { recursive: true })
		fs.writeFileSync(path.join(clientRoot, 'layouts', 'base.html'), '<html></html>')
		fs.writeFileSync(path.join(clientRoot, 'layouts', 'sub', 'ignored.html'), '<html></html>')

		const componentsDir = path.join(clientRoot, 'components')
		const layoutsDir = path.join(clientRoot, 'layouts')
		const index = buildTemplateTagIndex({ componentsDir, layoutsDir })

		expect([...index.components.keys()].sort()).toEqual(['a', 'b'])
		expect([...index.layouts.keys()]).toEqual(['base'])
		expect(
			walkHtmlFiles(componentsDir)
				.map(p => path.basename(p))
				.sort()
		).toEqual(['a.html', 'b.html'])
		expect(walkHtmlFilesDirectOnly(layoutsDir).map(p => path.basename(p))).toEqual(['base.html'])
	})

	it('buildTemplateTagIndexFromPaths accepts pre-discovered paths', () => {
		const tmp = mkTmp('aero-tti-paths-')
		tmpDirs.push(tmp)
		const componentsDir = path.join(tmp, 'client', 'components')
		const layoutsDir = path.join(tmp, 'client', 'layouts')
		fs.mkdirSync(componentsDir, { recursive: true })
		const footerPath = path.join(componentsDir, 'footer.html')
		fs.writeFileSync(footerPath, '<footer></footer>')

		const index = buildTemplateTagIndexFromPaths({
			componentPaths: [footerPath],
			layoutPaths: [],
			componentsDir,
			layoutsDir,
		})

		expect(resolveTemplateTag(index, 'component', 'footer').status).toBe('ok')
	})
})
