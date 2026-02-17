import type { Manifest } from 'vite'
import { describe, expect, it } from 'vitest'
import { __internal, createBuildConfig } from '../build'
import { resolveDirs } from '../defaults'

describe('vite build helpers', () => {
	it('maps routes to root-style output files', () => {
		expect(__internal.toOutputFile('')).toBe('index.html')
		expect(__internal.toOutputFile('404')).toBe('404.html')
		expect(__internal.toOutputFile('about')).toBe('about/index.html')
		expect(__internal.toOutputFile('docs/name')).toBe('docs/name/index.html')
	})

	it('rewrites route URLs to relative output paths', () => {
		const routeSet = new Set(['', 'about', 'docs', 'docs/name'])
		const manifest: Manifest = {}

		expect(__internal.rewriteAbsoluteUrl('/about', 'docs', manifest, routeSet)).toBe(
			'../about',
		)
		expect(__internal.rewriteAbsoluteUrl('/docs/name', 'docs', manifest, routeSet)).toBe(
			'./name',
		)
		expect(__internal.rewriteAbsoluteUrl('/', 'about', manifest, routeSet)).toBe('..')
	})

	it('rewrites asset URLs from manifest entries', () => {
		const routeSet = new Set<string>()
		const manifest: Manifest = {
			'client/index.ts': {
				file: 'assets/client/index-123.js',
				src: 'client/index.ts',
				isEntry: true,
			},
			'client/assets/styles/global.css': {
				file: 'assets/global-123.css',
				src: 'client/assets/styles/global.css',
				isEntry: true,
			},
		}

		expect(
			__internal.rewriteAbsoluteUrl('/client/index.ts', 'about', manifest, routeSet),
		).toBe('../assets/client/index-123.js')
		expect(
			__internal.rewriteAbsoluteUrl(
				'/client/assets/styles/global.css',
				'docs/name',
				manifest,
				routeSet,
			),
		).toBe('../../assets/global-123.css')
	})

	it('keeps api routes absolute for preview/server mode', () => {
		const routeSet = new Set<string>()
		const manifest: Manifest = {}
		expect(__internal.rewriteAbsoluteUrl('/api/submit', '', manifest, routeSet)).toBe(
			'/api/submit',
		)
	})

	it('resolves directory overrides; pages always derived from client', () => {
		expect(resolveDirs()).toEqual({
			client: 'client',
			server: 'server',
			dist: 'dist',
		})
		expect(resolveDirs({ client: 'site' })).toEqual({
			client: 'site',
			server: 'server',
			dist: 'dist',
		})
		expect(resolveDirs({ client: 'site', dist: 'build' })).toEqual({
			client: 'site',
			server: 'server',
			dist: 'build',
		})
	})

	it('sets build outDir from dirs.dist', () => {
		const build = createBuildConfig({ dirs: { dist: 'build' } }, process.cwd())
		expect(build?.outDir).toBe('build')
	})

	// =========================================================================
	// Dynamic page helpers
	// =========================================================================

	it('detects dynamic pages by bracket segments', () => {
		const staticPage = {
			pageName: 'about',
			routePath: 'about',
			sourceFile: '/client/pages/about.html',
			outputFile: 'about/index.html',
		}
		const dynamicPage = {
			pageName: '[id]',
			routePath: '[id]',
			sourceFile: '/client/pages/[id].html',
			outputFile: '[id]/index.html',
		}
		const nestedDynamic = {
			pageName: 'docs/[slug]',
			routePath: 'docs/[slug]',
			sourceFile: '/client/pages/docs/[slug].html',
			outputFile: 'docs/[slug]/index.html',
		}

		expect(__internal.isDynamicPage(staticPage)).toBe(false)
		expect(__internal.isDynamicPage(dynamicPage)).toBe(true)
		expect(__internal.isDynamicPage(nestedDynamic)).toBe(true)
	})

	it('expands bracket patterns with concrete params', () => {
		expect(__internal.expandPattern('[id]', { id: 'alpha' })).toBe('alpha')
		expect(__internal.expandPattern('docs/[slug]', { slug: 'intro' })).toBe('docs/intro')
		expect(
			__internal.expandPattern('[category]/[id]', { category: 'blog', id: 'post-1' }),
		).toBe('blog/post-1')
	})

	it('throws when a required param is missing from expandPattern', () => {
		expect(() => __internal.expandPattern('[id]', {})).toThrow('missing param "id"')
		expect(() => __internal.expandPattern('docs/[slug]', { id: 'x' })).toThrow(
			'missing param "slug"',
		)
	})
})
