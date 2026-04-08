import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AERO_EXIT_ROUTE } from '@aero-js/core/diagnostics'

afterEach(() => {
	vi.resetModules()
	vi.restoreAllMocks()
})

describe('runAeroCheck route diagnostics fallback', () => {
	it('falls back to local collision detection when manifest generation throws', async () => {
		vi.doMock('@aero-js/core/routing/route-manifest', () => ({
			buildRouteManifestWithDiagnostics: () => {
				throw new Error('forced test failure')
			},
			writeRouteManifestGenerated: () => {
				throw new Error('forced write failure')
			},
		}))
		vi.doMock('@aero-js/core/routing/route-typegen', () => ({
			writeRouteTypesGenerated: () => {},
		}))

		const { runAeroCheck } = await import('../check')
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-route-fallback-'))
		fs.mkdirSync(path.join(dir, 'client/pages/a'), { recursive: true })
		fs.writeFileSync(path.join(dir, 'client/pages/a/index.html'), '<p>a</p>\n', 'utf-8')
		fs.writeFileSync(path.join(dir, 'client/pages/a.html'), '<p>b</p>\n', 'utf-8')
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)

		try {
			const code = await runAeroCheck(dir)
			expect(code).toBe(AERO_EXIT_ROUTE)
			const out = spy.mock.calls.map(args => String(args[0])).join('')
			expect(out).toContain('[AERO_ROUTE]')
			expect(out).toContain('Duplicate route path')
		} finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})

	it('reports AERO_ROUTE when writing generated route artifacts fails', async () => {
		vi.doMock('@aero-js/core/routing/route-manifest', async importOriginal => {
			const original = (await importOriginal()) as Record<string, unknown>
			return {
				...original,
				writeRouteManifestGenerated: () => {
					throw new Error('EACCES: permission denied')
				},
			}
		})
		vi.doMock('@aero-js/core/routing/route-typegen', async importOriginal => {
			const original = (await importOriginal()) as Record<string, unknown>
			return {
				...original,
			}
		})

		const { runAeroCheck } = await import('../check')
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-route-write-fail-'))
		fs.mkdirSync(path.join(dir, 'client/pages'), { recursive: true })
		fs.writeFileSync(path.join(dir, 'client/pages/index.html'), '<p>home</p>\n', 'utf-8')
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)

		try {
			const code = await runAeroCheck(dir)
			expect(code).toBe(AERO_EXIT_ROUTE)
			const out = spy.mock.calls.map(args => String(args[0])).join('')
			expect(out).toContain('[AERO_ROUTE]')
			expect(out).toContain('Failed to write generated route artifacts')
		} finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})
})
