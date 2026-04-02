/**
 * Tests for the content Vite plugin: resolveId, load, configResolved, handleHotUpdate.
 * Virtual module aero:content (and aero:content/…) resolves to serialized collections + getCollection + render.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aeroContent } from '../vite'

describe('aeroContent', () => {
	it('returns a plugin named vite-plugin-aero-content', () => {
		const plugin = aeroContent()
		expect(plugin.name).toBe('vite-plugin-aero-content')
	})

	it('accepts custom config path option', () => {
		const plugin = aeroContent({ config: 'custom.content.ts' })
		expect(plugin.name).toBe('vite-plugin-aero-content')
	})

	describe('resolveId', () => {
		it('resolves aero:content to the virtual module ID', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('aero:content')).toBe('\0aero:content')
		})

		it('resolves aero:content/<name> to the same virtual module', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('aero:content/docs')).toBe('\0aero:content')
			expect(resolveId('aero:content/posts')).toBe('\0aero:content')
		})

		it('returns null for unrelated module IDs', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('some-other-module')).toBeNull()
			expect(resolveId('aero:other')).toBeNull()
		})
	})

	describe('load', () => {
		it('exports render and getCollection stub when no config is loaded', async () => {
			const plugin = aeroContent()
			const load = plugin.load as Function
			const result = await load('\0aero:content')
			expect(result).toContain("export { render } from '@aero-js/content/render'")
			expect(result).toContain('export function getCollection')
			expect(result).toContain('No content.config.ts found')
		})

		it('returns null for non-content module IDs', async () => {
			const plugin = aeroContent()
			const load = plugin.load as Function
			const result = await load('some-other-module')
			expect(result).toBeNull()
		})
	})

	describe('configResolved', () => {
		const mockConfig = {
			root: '/project',
			logger: { warn: vi.fn() },
		}

		beforeEach(() => {
			vi.clearAllMocks()
		})

		it('warns when config file cannot be loaded (missing in temp dir)', async () => {
			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-content-'))
			try {
				const plugin = aeroContent()
				const configResolved = plugin.configResolved as Function
				const warnSpy = vi.spyOn(mockConfig.logger, 'warn')
				const configWithTmpRoot = { ...mockConfig, root: tmp }

				await configResolved(configWithTmpRoot as any)

				expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No config found'))
			} finally {
				fs.rmSync(tmp, { recursive: true, force: true })
			}
		})
	})

	describe('handleHotUpdate', () => {
		let plugin: ReturnType<typeof aeroContent>
		let handleHotUpdate: Function

		beforeEach(() => {
			plugin = aeroContent()
			handleHotUpdate = plugin.handleHotUpdate as Function
		})

		/** Relies on mutating plugin internals (watchedDirs); full flow would require configResolved with real config. */
		it('does not invalidate or full-reload when changed file is outside watched dirs', () => {
			const mockServer = {
				moduleGraph: {
					getModuleById: vi.fn().mockReturnValue(null),
				},
				hot: {
					send: vi.fn(),
				},
			}

			;(plugin as any).__hotState.watchedDirs = ['/project/content']

			handleHotUpdate({
				file: '/project/src/other.ts',
				server: mockServer,
			})

			expect(mockServer.hot.send).not.toHaveBeenCalled()
		})

		it('invalidates md + virtual modules and returns them for HMR (no full-reload)', () => {
			const mdMod = { id: '/project/content/foo.md' } as any
			const vmMod = { id: '\0aero:content' } as any
			const mockServer = {
				moduleGraph: {
					getModuleById: vi.fn((id: string) => {
						if (id === '/project/content/foo.md') return mdMod
						if (id === '\0aero:content') return vmMod
						return null
					}),
					invalidateModule: vi.fn(),
				},
				hot: { send: vi.fn() },
			}
			;(plugin as any).__hotState.watchedDirs = ['/project/content']

			const result = handleHotUpdate({
				file: '/project/content/foo.md',
				server: mockServer as any,
			})

			expect(mockServer.hot.send).not.toHaveBeenCalled()
			expect(mockServer.moduleGraph.invalidateModule).toHaveBeenCalledWith(mdMod)
			expect(mockServer.moduleGraph.invalidateModule).toHaveBeenCalledWith(vmMod)
			expect(result).toEqual([mdMod, vmMod])
		})
	})
})
