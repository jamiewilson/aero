/**
 * Unit tests for utils/routing.ts: resolvePageName, pagePathToKey, resolveDynamicPage, resolvePageTarget.
 */

import { describe, it, expect } from 'vitest'
import {
	pagePathToKey,
	resolveDynamicPage,
	resolvePageName,
	resolvePageTarget,
} from '../routing'

describe('pagePathToKey', () => {
	it('should use segment after pages/ for page paths', () => {
		expect(pagePathToKey('pages/index.html')).toBe('index')
		expect(pagePathToKey('pages/about.html')).toBe('about')
		expect(pagePathToKey('client/pages/blog/post.html')).toBe('blog/post')
		expect(pagePathToKey('client/pages/blog/[id].html')).toBe('blog/[id]')
	})

	it('should handle paths without .html', () => {
		expect(pagePathToKey('pages/contact')).toBe('contact')
	})

	it('should use full path for multi-segment paths without pages/', () => {
		expect(pagePathToKey('layouts/base.html')).toBe('layouts/base')
		expect(pagePathToKey('components/header.html')).toBe('components/header')
	})

	it('should use last segment for single-segment paths', () => {
		expect(pagePathToKey('index.html')).toBe('index')
	})

	it('should normalize backslashes', () => {
		expect(pagePathToKey('client\\pages\\about.html')).toBe('about')
	})
})

describe('resolvePageName', () => {
	it('should return index for root path', () => {
		expect(resolvePageName('/')).toBe('index')
	})

	it('should return index for empty string', () => {
		expect(resolvePageName('')).toBe('index')
	})

	it('should return page name for simple path', () => {
		expect(resolvePageName('/about')).toBe('about')
	})

	it('should remove .html extension', () => {
		expect(resolvePageName('/about.html')).toBe('about')
	})

	it('should handle trailing slash as index', () => {
		expect(resolvePageName('/blog/')).toBe('blog/index')
	})

	it('should handle nested paths', () => {
		expect(resolvePageName('/blog/post')).toBe('blog/post')
	})

	it('should ignore query strings', () => {
		expect(resolvePageName('/about?foo=bar')).toBe('about')
	})

	it('should handle path with query and hash', () => {
		expect(resolvePageName('/about?foo=bar#section')).toBe('about')
	})

	it('should handle root with query string', () => {
		expect(resolvePageName('/?page=1')).toBe('index')
	})
})

describe('resolveDynamicPage', () => {
	it('should return null for empty map', () => {
		expect(resolveDynamicPage('any', {})).toBeNull()
	})

	it('should match single dynamic segment', () => {
		const pagesMap: Record<string, any> = {
			'[slug]': { default: () => 'dynamic' },
		}
		const result = resolveDynamicPage('hello', pagesMap)
		expect(result).not.toBeNull()
		expect(result!.pageName).toBe('[slug]')
		expect(result!.params.slug).toBe('hello')
	})

	it('should match nested dynamic segment', () => {
		const pagesMap: Record<string, any> = {
			'blog/[id]': { default: () => 'blog' },
		}
		const result = resolveDynamicPage('blog/123', pagesMap)
		expect(result).not.toBeNull()
		expect(result!.params.id).toBe('123')
	})

	it('should return null when segment count does not match', () => {
		const pagesMap: Record<string, any> = {
			'blog/[id]': { default: () => 'blog' },
		}
		expect(resolveDynamicPage('blog', pagesMap)).toBeNull()
		expect(resolveDynamicPage('blog/1/extra', pagesMap)).toBeNull()
	})
})

describe('resolvePageTarget', () => {
	it('should return null for null/undefined component', () => {
		expect(resolvePageTarget(null, {})).toBeNull()
		expect(resolvePageTarget(undefined, {})).toBeNull()
	})

	it('should return module and pageName for non-string component', () => {
		const mod = { default: () => 'html' }
		const result = resolvePageTarget(mod, {})
		expect(result).toEqual({ module: mod, pageName: 'index', params: {} })
	})

	it('should resolve direct key', () => {
		const mod = { default: () => 'about' }
		const result = resolvePageTarget('about', { about: mod })
		expect(result).toEqual({ module: mod, pageName: 'about', params: {} })
	})

	it('should fallback to directory index', () => {
		const mod = { default: () => 'docs' }
		const result = resolvePageTarget('docs', { 'docs/index': mod })
		expect(result).toEqual({ module: mod, pageName: 'docs', params: {} })
	})

	it('should fallback to home for index', () => {
		const mod = { default: () => 'home' }
		const result = resolvePageTarget('index', { home: mod })
		expect(result).toEqual({ module: mod, pageName: 'index', params: {} })
	})

	it('should resolve dynamic route', () => {
		const mod = { default: () => 'post' }
		const result = resolvePageTarget('blog/42', { 'blog/[id]': mod })
		expect(result).not.toBeNull()
		expect(result!.module).toBe(mod)
		expect(result!.pageName).toBe('blog/[id]')
		expect(result!.params.id).toBe('42')
	})

	it('should strip /index and try static then dynamic', () => {
		const mod = { default: () => 'foo' }
		const result = resolvePageTarget('foo/index', { foo: mod })
		expect(result).toEqual({ module: mod, pageName: 'foo', params: {} })
	})

	it('should return null for unknown page name', () => {
		expect(resolvePageTarget('nonexistent', {})).toBeNull()
		expect(resolvePageTarget('unknown', { index: {} })).toBeNull()
	})
})
