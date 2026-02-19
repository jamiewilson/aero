import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadTsconfigAliases } from '../aliases'

vi.mock('get-tsconfig', () => ({
	getTsconfig: vi.fn(),
}))

describe('loadTsconfigAliases', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should return empty result when no tsconfig found', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue(null)

		const result = loadTsconfigAliases('/project')
		expect(result.aliases).toEqual([])
		expect(result.resolvePath).toBeUndefined()
	})

	it('should return empty result when no paths defined', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue({
			path: '/project/tsconfig.json',
			config: { compilerOptions: {} },
		})

		const result = loadTsconfigAliases('/project')
		expect(result.aliases).toEqual([])
	})

	it('should parse paths from tsconfig', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue({
			path: '/project/tsconfig.json',
			config: {
				compilerOptions: {
					baseUrl: '.',
					paths: {
						'@components/*': ['src/components/*'],
						'@layouts/*': ['src/layouts/*'],
					},
				},
			},
		})

		const result = loadTsconfigAliases('/project')
		
		expect(result.aliases).toHaveLength(2)
		expect(result.aliases[0]).toEqual({
			find: '@components',
			replacement: '/project/src/components',
		})
		expect(result.aliases[1]).toEqual({
			find: '@layouts',
			replacement: '/project/src/layouts',
		})
	})

	it('should resolve paths correctly', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue({
			path: '/project/tsconfig.json',
			config: {
				compilerOptions: {
					baseUrl: '.',
					paths: {
						'@components/*': ['src/components/*'],
					},
				},
			},
		})

		const result = loadTsconfigAliases('/project')
		
		expect(result.resolvePath).toBeDefined()
		expect(result.resolvePath!('@components/header')).toBe('/project/src/components/header')
		expect(result.resolvePath!('@components')).toBe('/project/src/components')
		expect(result.resolvePath!('other')).toBe('other')
	})

	it('should handle nested paths', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue({
			path: '/project/tsconfig.json',
			config: {
				compilerOptions: {
					baseUrl: '.',
					paths: {
						'@/*': ['src/*'],
					},
				},
			},
		})

		const result = loadTsconfigAliases('/project')
		
		expect(result.resolvePath).toBeDefined()
		expect(result.resolvePath!('@/components/Button')).toBe('/project/src/components/Button')
	})
})
