/**
 * Unit tests for the Vite static build pipeline (build.ts) and related defaults.
 *
 * Covers route→output mapping, URL rewriting (routes, assets, API passthrough),
 * directory resolution, build config, and dynamic page helpers (bracket patterns,
 * expandPattern, isDynamicPage). Does not run full renderStaticPages integration.
 */

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

	/**
	 * rewriteAbsoluteUrl: fromDir is the output directory (e.g. "docs" for docs/index.html).
	 * Route links become relative paths with trailing slash for directory indexes; root is ".." from a child route.
	 */
	it('rewrites route URLs to relative output paths', () => {
		const routeSet = new Set(['', 'about', 'docs', 'docs/name'])
		const manifest: Manifest = {}

		expect(__internal.rewriteAbsoluteUrl('/about', 'docs', manifest, routeSet)).toBe(
			'../about/',
		)
		expect(__internal.rewriteAbsoluteUrl('/docs/name', 'docs', manifest, routeSet)).toBe(
			'./name/',
		)
		expect(__internal.rewriteAbsoluteUrl('/', 'about', manifest, routeSet)).toBe('..')
	})

	/** normalizeRelativeRouteLink: fromDir → routePath; appends trailing slash except for root and 404 (file). */
	it('normalizes relative route links with trailing slashes for directories', () => {
		expect(__internal.normalizeRelativeRouteLink('', 'docs')).toBe('./docs/')
		expect(__internal.normalizeRelativeRouteLink('about', 'docs')).toBe('../docs/')
		expect(__internal.normalizeRelativeRouteLink('', 'about/team')).toBe('./about/team/')
		expect(__internal.normalizeRelativeRouteLink('about', '')).toBe('..')
		expect(__internal.normalizeRelativeRouteLink('', '')).toBe('./')
		expect(__internal.normalizeRelativeRouteLink('', '404')).toBe('./404')
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

	/** Root-relative script src is resolved via manifest (build discovers and bundles template refs). */
	it('rewrites local script src (root-relative path) to manifest asset path', () => {
		const routeSet = new Set<string>()
		expect(
			__internal.rewriteAbsoluteUrl(
				'/client/assets/scripts/module.ts',
				'',
				{
					'client/assets/scripts/module.ts': {
						file: 'assets/module.ts-abc123.js',
						src: 'client/assets/scripts/module.ts',
						isEntry: true,
					},
				},
				routeSet,
			),
		).toBe('./assets/module.ts-abc123.js')
	})

	/**
	 * rewriteRenderedHtml parses HTML, rewrites script[src] for CLIENT_SCRIPT_PREFIX to hashed asset,
	 * sets type="module", and adds doctype. LINK_ATTRS (href, action, hx-*) are also rewritten in the real path.
	 * TODO: Add a case that asserts href/action/hx-* rewrite on a full document for regression coverage.
	 */
	it('rewrites virtual client script src to manifest asset path in rewriteRenderedHtml', () => {
		const html = `<html><body><script type="module" src="/@aero/client/client/pages/home.js"></script></body></html>`
		const manifest: Manifest = {
			'/@aero/client/client/pages/home.js': {
				file: 'assets/home.js-abc123.js',
				src: '/@aero/client/client/pages/home.js',
				isEntry: true,
			},
		}
		const result = __internal.rewriteRenderedHtml(html, 'index.html', manifest, new Set())
		expect(result).toContain('src="./assets/home.js-abc123.js"')
		expect(result).toContain('type="module"')
		expect(result).not.toContain('@aero/client')
	})

	/** URLs under apiPrefix are left absolute so server/preview can handle them. */
	it('keeps api routes absolute for preview/server mode', () => {
		const routeSet = new Set<string>()
		const manifest: Manifest = {}
		expect(__internal.rewriteAbsoluteUrl('/api/submit', '', manifest, routeSet)).toBe(
			'/api/submit',
		)
	})
	// FIXME: rewriteAbsoluteUrl edge cases not covered: query/hash preservation (suffix), /assets/ path when not in manifest, dist-root files (e.g. /favicon.ico).

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
	// Dynamic page helpers (bracket segments, expandPattern, getStaticPaths)
	// =========================================================================

	/** isDynamicPage: any pageName containing [...] is dynamic; used to branch on getStaticPaths. */
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

	/** expandPattern replaces [key] with params[key]; used for getStaticPaths → output paths. */
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

	// TODO: Consider direct unit tests for __internal.normalizeRelativeLink (empty, same-dir) and integration test for renderStaticPages/discoverPages.
})
