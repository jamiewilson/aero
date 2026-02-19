import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aeroContent } from '../vite'

describe('aeroContent', () => {
	it('should return a plugin with the correct name', () => {
		const plugin = aeroContent()
		expect(plugin.name).toBe('vite-plugin-aero-content')
	})

	it('should accept custom config path option', () => {
		const plugin = aeroContent({ config: 'custom.content.ts' })
		expect(plugin.name).toBe('vite-plugin-aero-content')
	})

	describe('resolveId', () => {
		it('should resolve aero:content to the virtual module ID', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('aero:content')).toBe('\0aero:content')
		})

		it('should resolve aero:content/collection to the same virtual module', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('aero:content/docs')).toBe('\0aero:content')
			expect(resolveId('aero:content/posts')).toBe('\0aero:content')
		})

		it('should return null for unrelated module IDs', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('some-other-module')).toBeNull()
			expect(resolveId('aero:other')).toBeNull()
		})
	})

	describe('load', () => {
		it('should return a comment stub when no config is loaded', async () => {
			const plugin = aeroContent()
			const load = plugin.load as Function
			const result = await load('\0aero:content')
			expect(result).toContain('no collections configured')
		})

		it('should return null for unrelated module IDs', async () => {
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

		it('should warn and skip when config file does not exist', async () => {
			const plugin = aeroContent()
			const configResolved = plugin.configResolved as Function

			const warnSpy = vi.spyOn(mockConfig.logger, 'warn')

			vi.mock('node:fs', () => ({
				readFileSync: () => {
					throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
				},
			}))

			await configResolved(mockConfig as any)

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('No config found'),
			)
		})
	})

	describe('handleHotUpdate', () => {
		let plugin: ReturnType<typeof aeroContent>
		let handleHotUpdate: Function

		beforeEach(() => {
			plugin = aeroContent()
			handleHotUpdate = plugin.handleHotUpdate as Function
		})

		it('should do nothing when file is not in watched directories', () => {
			const mockServer = {
				moduleGraph: {
					getModuleById: vi.fn().mockReturnValue(null),
				},
				hot: {
					send: vi.fn(),
				},
			}

			plugin.configResolved = vi.fn().mockImplementation(async (config: any) => {
				;(plugin as any).watchedDirs = ['/project/content']
			})

			handleHotUpdate({
				file: '/project/src/other.ts',
				server: mockServer,
			})

			expect(mockServer.hot.send).not.toHaveBeenCalled()
		})
	})
})
