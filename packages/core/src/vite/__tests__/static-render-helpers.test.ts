/**
 * Characterization tests for static prerender helpers (redirect filter, dynamic expansion).
 */

import { describe, expect, it, vi } from 'vitest'
import { expandDynamicPages } from '../static-dynamic-expansion'
import { filterPagesAgainstRedirects } from '../static-incremental-gate'
import type { StaticPage } from '../static-page-discovery'

function page(partial: Partial<StaticPage> & Pick<StaticPage, 'pageName' | 'routePath'>): StaticPage {
	return {
		sourceFile: `/proj/client/pages/${partial.pageName}.html`,
		outputFile: partial.routePath === '' ? 'index.html' : `${partial.routePath}/index.html`,
		...partial,
	}
}

describe('filterPagesAgainstRedirects', () => {
	it('returns all pages when redirects are empty', () => {
		const pages = [page({ pageName: 'about', routePath: 'about' })]
		expect(filterPagesAgainstRedirects(pages, undefined)).toEqual(pages)
		expect(filterPagesAgainstRedirects(pages, [])).toEqual(pages)
	})

	it('drops pages whose routePath matches a redirect from', () => {
		const pages = [
			page({ pageName: 'index', routePath: '' }),
			page({ pageName: 'old', routePath: 'old' }),
			page({ pageName: 'about', routePath: 'about' }),
		]
		const filtered = filterPagesAgainstRedirects(pages, [
			{ from: '/old', to: '/about', status: 301 },
		])
		expect(filtered.map(p => p.routePath)).toEqual(['', 'about'])
	})
})

describe('expandDynamicPages', () => {
	it('passes through static pages unchanged', async () => {
		const staticOnly = [page({ pageName: 'about', routePath: 'about' })]
		const importPage = vi.fn()
		const result = await expandDynamicPages(staticOnly, '/proj', importPage)
		expect(result).toEqual(staticOnly)
		expect(importPage).not.toHaveBeenCalled()
	})

	it('expands dynamic pages via getStaticPaths', async () => {
		const discovered = [
			page({
				pageName: 'posts/[id]',
				routePath: 'posts/[id]',
				sourceFile: '/proj/client/pages/posts/[id].html',
			}),
		]
		const importPage = vi.fn().mockResolvedValue({
			getStaticPaths: async () => [
				{ params: { id: 'a' }, props: { title: 'A' } },
				{ params: { id: 'b' } },
			],
		})
		const result = await expandDynamicPages(discovered, '/proj', importPage)
		expect(importPage).toHaveBeenCalledWith('/proj/client/pages/posts/[id].html')
		expect(result).toHaveLength(2)
		expect(result[0]).toMatchObject({
			pageName: 'posts/a',
			routePath: 'posts/a',
			params: { id: 'a' },
			props: { title: 'A' },
			outputFile: 'posts/a/index.html',
		})
		expect(result[1]).toMatchObject({
			pageName: 'posts/b',
			routePath: 'posts/b',
			params: { id: 'b' },
		})
	})

	it('skips dynamic pages without getStaticPaths', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const discovered = [
			page({
				pageName: 'posts/[id]',
				routePath: 'posts/[id]',
				sourceFile: '/proj/client/pages/posts/[id].html',
			}),
		]
		const result = await expandDynamicPages(discovered, '/proj', async () => ({}))
		expect(result).toEqual([])
		expect(warn).toHaveBeenCalled()
		warn.mockRestore()
	})
})
