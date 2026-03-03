/**
 * Unit tests for utils/aliases.ts: loadTsconfigAliases with mocked get-tsconfig,
 * and mergeWithDefaultAliases / getDefaultAliases.
 */

import * as path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	getDefaultAliases,
	loadTsconfigAliases,
	mergeWithDefaultAliases,
} from '../aliases'

const defaultDirs = { client: 'client', server: 'server', dist: 'dist' }

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
		expect(result.resolve).toBeDefined()
		expect(typeof result.resolve).toBe('function')
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
		const kitchenSink = path.join(process.cwd(), 'examples/kitchen-sink')
		const importer = path.join(kitchenSink, 'client/pages/index.html')
		const result = loadTsconfigAliases(kitchenSink)

		expect(result.resolve).toBeDefined()
		expect(result.aliases.length).toBeGreaterThan(0)

		const resolved = result.resolve('@components/header', importer)
		expect(resolved).toBeDefined()
		expect(resolved).toContain('components')
		expect(resolved).toContain('header')
	})

	it('should handle nested paths', async () => {
		const kitchenSink = path.join(process.cwd(), 'examples/kitchen-sink')
		const importer = path.join(kitchenSink, 'client/pages/index.html')
		const result = loadTsconfigAliases(kitchenSink)

		expect(result.resolve).toBeDefined()
		const resolved = result.resolve('@components/header', importer)
		expect(resolved).toBeDefined()
		expect(resolved).toContain('components')
	})
})

describe('getDefaultAliases', () => {
	it('returns @pages, @layouts, @components from root and dirs', () => {
		const root = '/project'
		const aliases = getDefaultAliases(root, defaultDirs)
		expect(aliases).toHaveLength(3)
		expect(aliases.map(a => a.find).sort()).toEqual([
			'@components',
			'@layouts',
			'@pages',
		])
		expect(aliases.find(a => a.find === '@pages')!.replacement).toBe(
			path.join(root, 'client', 'pages'),
		)
		expect(aliases.find(a => a.find === '@layouts')!.replacement).toBe(
			path.join(root, 'client', 'layouts'),
		)
		expect(aliases.find(a => a.find === '@components')!.replacement).toBe(
			path.join(root, 'client', 'components'),
		)
	})

	it('uses custom client dir when provided', () => {
		const root = '/app'
		const aliases = getDefaultAliases(root, {
			...defaultDirs,
			client: 'frontend',
		})
		expect(aliases.find(a => a.find === '@pages')!.replacement).toBe(
			path.join(root, 'frontend', 'pages'),
		)
	})
})

describe('mergeWithDefaultAliases', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('adds default aliases when tsconfig had none', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue(null)
		const raw = loadTsconfigAliases('/project')
		expect(raw.aliases).toEqual([])

		const merged = mergeWithDefaultAliases(raw, '/project', defaultDirs)
		expect(merged.aliases).toHaveLength(3)
		expect(merged.aliases.map(a => a.find).sort()).toEqual([
			'@components',
			'@layouts',
			'@pages',
		])
		expect(merged.resolve('@components/header', '/project/client/pages/index.html')).toBe(
			path.join('/project', 'client', 'components', 'header'),
		)
	})

	it('lets tsconfig override default for same key', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue({
			path: '/project/tsconfig.json',
			config: {
				compilerOptions: {
					baseUrl: '.',
					paths: {
						'@pages/*': ['src/views/*'],
					},
				},
			},
		})
		const raw = loadTsconfigAliases('/project')
		const merged = mergeWithDefaultAliases(raw, '/project', defaultDirs)
		const pagesAlias = merged.aliases.find(a => a.find === '@pages')
		expect(pagesAlias!.replacement).toBe(path.resolve('/project', 'src/views'))
		expect(merged.aliases.find(a => a.find === '@layouts')!.replacement).toBe(
			path.join('/project', 'client', 'layouts'),
		)
	})

	it('resolve uses merged aliases first then fallback', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue(null)
		const raw = loadTsconfigAliases('/project')
		const merged = mergeWithDefaultAliases(raw, '/project', defaultDirs)
		const resolved = merged.resolve('@components/header', '/project/client/pages/index.html')
		expect(resolved).toBe(path.join('/project', 'client', 'components', 'header'))
	})
})
