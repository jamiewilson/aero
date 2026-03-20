/**
 * Unit tests for utils/aliases.ts: loadTsconfigAliases with mocked get-tsconfig,
 * and mergeWithDefaultAliases / getDefaultAliases.
 */

import * as path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	getDefaultAliases,
	jitiAliasRecordFromProject,
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
	it('returns all standard aliases from root and dirs', () => {
		const root = '/project'
		const aliases = getDefaultAliases(root, defaultDirs)
		expect(aliases).toHaveLength(7)
		expect(aliases.map(a => a.find).sort()).toEqual([
			'@components',
			'@content',
			'@images',
			'@layouts',
			'@pages',
			'@scripts',
			'@styles',
		])
		expect(aliases.find(a => a.find === '@pages')!.replacement).toBe(
			path.join(root, 'client', 'pages')
		)
		expect(aliases.find(a => a.find === '@layouts')!.replacement).toBe(
			path.join(root, 'client', 'layouts')
		)
		expect(aliases.find(a => a.find === '@components')!.replacement).toBe(
			path.join(root, 'client', 'components')
		)
		expect(aliases.find(a => a.find === '@styles')!.replacement).toBe(
			path.join(root, 'client', 'assets', 'styles')
		)
		expect(aliases.find(a => a.find === '@content')!.replacement).toBe(
			path.join(root, 'content')
		)
	})

	it('uses custom client dir when provided', () => {
		const root = '/app'
		const aliases = getDefaultAliases(root, {
			...defaultDirs,
			client: 'frontend',
		})
		expect(aliases.find(a => a.find === '@pages')!.replacement).toBe(
			path.join(root, 'frontend', 'pages')
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
		expect(merged.aliases).toHaveLength(7)
		expect(merged.aliases.map(a => a.find).sort()).toEqual([
			'@components',
			'@content',
			'@images',
			'@layouts',
			'@pages',
			'@scripts',
			'@styles',
		])
		expect(
			merged.resolve('@components/header', '/project/client/pages/index.html')
		).toBe(path.join('/project', 'client', 'components', 'header'))
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
			path.join('/project', 'client', 'layouts')
		)
	})

	it('resolve uses merged aliases first then fallback', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue(null)
		const raw = loadTsconfigAliases('/project')
		const merged = mergeWithDefaultAliases(raw, '/project', defaultDirs)
		const resolved = merged.resolve(
			'@components/header',
			'/project/client/pages/index.html'
		)
		expect(resolved).toBe(
			path.join('/project', 'client', 'components', 'header')
		)
	})
})

describe('jitiAliasRecordFromProject', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('matches mergeWithDefaultAliases as a flat prefix → dir map for jiti', async () => {
		const { getTsconfig } = await import('get-tsconfig')
		;(getTsconfig as ReturnType<typeof vi.fn>).mockReturnValue(null)
		const merged = mergeWithDefaultAliases(
			loadTsconfigAliases('/project'),
			'/project',
			defaultDirs
		)
		const jitiMap = jitiAliasRecordFromProject('/project')
		expect(jitiMap).toEqual(
			Object.fromEntries(merged.aliases.map(a => [a.find, a.replacement]))
		)
		expect(jitiMap['@pages']).toBe(path.join('/project', 'client', 'pages'))
	})
})
