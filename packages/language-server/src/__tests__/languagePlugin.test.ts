import { describe, it, expect } from 'vitest'
import { aeroLanguagePlugin } from '../languagePlugin'
import { AeroVirtualCode } from '../virtualCode'
import { URI } from 'vscode-uri'
import type { IScriptSnapshot } from '@volar/language-core'

function createSnapshot(text: string): IScriptSnapshot {
	return {
		getText: (start: number, end: number) => text.substring(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	}
}

const dummyCtx = { getAssociatedScript: () => undefined }

describe('aeroLanguagePlugin', () => {
	describe('getLanguageId', () => {
		it('returns "aero" for .html files', () => {
			const uri = URI.file('/project/client/pages/index.html')
			expect(aeroLanguagePlugin.getLanguageId(uri)).toBe('aero')
		})

		it('returns undefined for non-HTML files', () => {
			expect(aeroLanguagePlugin.getLanguageId(URI.file('/project/main.ts'))).toBeUndefined()
			expect(aeroLanguagePlugin.getLanguageId(URI.file('/project/style.css'))).toBeUndefined()
		})
	})

	describe('createVirtualCode', () => {
		it('creates AeroVirtualCode for aero language ID', () => {
			const snapshot = createSnapshot('<div>test</div>')
			const uri = URI.file('/project/test.html')
			const result = aeroLanguagePlugin.createVirtualCode!(uri, 'aero', snapshot, dummyCtx)
			expect(result).toBeInstanceOf(AeroVirtualCode)
		})

		it('creates AeroVirtualCode for html language ID on .html (editor often has not switched to aero yet)', () => {
			const snapshot = createSnapshot('<div>test</div>')
			const uri = URI.file('/project/test.html')
			const result = aeroLanguagePlugin.createVirtualCode!(uri, 'html', snapshot, dummyCtx)
			expect(result).toBeInstanceOf(AeroVirtualCode)
		})

		it('returns undefined for html language ID on non-.html paths', () => {
			const snapshot = createSnapshot('<div>test</div>')
			const uri = URI.file('/project/readme.md')
			const result = aeroLanguagePlugin.createVirtualCode!(uri, 'html', snapshot, dummyCtx)
			expect(result).toBeUndefined()
		})
	})

	describe('typescript config', () => {
		it('has .html in extraFileExtensions', () => {
			const tsConfig = aeroLanguagePlugin.typescript!
			expect(tsConfig.extraFileExtensions).toContainEqual(
				expect.objectContaining({ extension: 'html', isMixedContent: true })
			)
		})

		it('getServiceScript returns a module script for .html resolution', () => {
			const tsConfig = aeroLanguagePlugin.typescript!
			const snapshot = createSnapshot('<div>test</div>')
			const code = new AeroVirtualCode(snapshot)
			const result = tsConfig.getServiceScript(code)

			expect(result).toBeDefined()
			expect(result!.extension).toBe('.ts')
			expect(result!.scriptKind).toBe(3) // ts.ScriptKind.TS
			expect(result!.code.languageId).toBe('typescript')

			const text = result!.code.snapshot.getText(0, result!.code.snapshot.getLength())
			expect(text).toContain('export default')
		})

		it('has resolveHiddenExtensions enabled', () => {
			const tsConfig = aeroLanguagePlugin.typescript!
			expect((tsConfig as any).resolveHiddenExtensions).toBe(true)
		})

		it('getExtraServiceScripts returns TS scripts for embedded codes', () => {
			const html = `<script is:build lang="ts">
const { title } = Aero.props
</script>
<script lang="ts">
console.log('client')
</script>`

			const snapshot = createSnapshot(html)
			const code = new AeroVirtualCode(snapshot)
			const tsConfig = aeroLanguagePlugin.typescript!
			const scripts = tsConfig.getExtraServiceScripts!('test.html', code)

			const tsScripts = scripts.filter(s => !s.fileName.endsWith('.d.ts'))
			expect(tsScripts.length).toBe(2)
			expect(tsScripts[0].fileName).toContain('build_0.ts')
			expect(tsScripts[0].extension).toBe('.ts')
			expect(tsScripts[1].fileName).toContain('client_0.ts')

			const dtsScripts = scripts.filter(s => s.fileName.endsWith('.d.ts'))
			expect(dtsScripts.length).toBe(1)
			expect(dtsScripts[0].fileName).toContain('ambient.d.ts')
			expect(dtsScripts[0].extension).toBe('.d.ts')
		})
	})
})
