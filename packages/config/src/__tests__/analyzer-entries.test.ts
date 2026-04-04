import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getAeroAnalyzerEntryGlobs, listAeroTemplatePaths } from '../analyzer-entries'
import type { AeroConfig } from '../types'

describe('getAeroAnalyzerEntryGlobs', () => {
	it('uses default client/server dirs when config empty', () => {
		const globs = getAeroAnalyzerEntryGlobs(process.cwd(), {})
		expect(globs).toContain('client/pages/**/*.html')
		expect(globs).toContain('server/**/*.ts')
	})

	it('respects custom dirs from config', () => {
		const config: AeroConfig = {
			dirs: { client: './frontend', server: './backend' },
		}
		const globs = getAeroAnalyzerEntryGlobs(process.cwd(), config)
		expect(globs).toContain('frontend/pages/**/*.html')
		expect(globs).toContain('backend/**/*.ts')
	})
})

describe('listAeroTemplatePaths', () => {
	it('returns sorted template paths for a temp layout', () => {
		const tmp = path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'analyzer-mini')
		const config: AeroConfig = { dirs: { client: 'client' } }
		const t = listAeroTemplatePaths(tmp, config)
		expect(t.pages).toContain('client/pages/x.html')
		expect(t.layouts).toContain('client/layouts/base.html')
		expect(t.components).toContain('client/components/c.html')
	})
})
