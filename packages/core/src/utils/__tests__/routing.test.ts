/**
 * Unit tests for utils/routing.ts: resolvePageName mapping URL paths to page names.
 * Covers root, simple/nested paths, .html strip, trailing slash → index, and query/hash stripping.
 */

import { describe, it, expect } from 'vitest'
import { resolvePageName } from '../routing'

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
