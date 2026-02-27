/**
 * Unit tests for utils/route-pattern.ts: parseRoutePattern, matchRoutePattern,
 * expandRoutePattern, isDynamicRoutePattern.
 */

import { describe, it, expect } from 'vitest'
import {
	parseRoutePattern,
	matchRoutePattern,
	expandRoutePattern,
	isDynamicRoutePattern,
} from '../route-pattern'

describe('parseRoutePattern', () => {
	it('parses static-only pattern', () => {
		expect(parseRoutePattern('about')).toEqual({
			segments: [{ type: 'static', value: 'about' }],
		})
		expect(parseRoutePattern('blog/post')).toEqual({
			segments: [
				{ type: 'static', value: 'blog' },
				{ type: 'static', value: 'post' },
			],
		})
	})

	it('parses single param segment', () => {
		expect(parseRoutePattern('[slug]')).toEqual({
			segments: [{ type: 'param', name: 'slug' }],
		})
		expect(parseRoutePattern('[id]')).toEqual({
			segments: [{ type: 'param', name: 'id' }],
		})
	})

	it('parses mixed static and param segments', () => {
		expect(parseRoutePattern('blog/[id]')).toEqual({
			segments: [
				{ type: 'static', value: 'blog' },
				{ type: 'param', name: 'id' },
			],
		})
		expect(parseRoutePattern('docs/[slug]')).toEqual({
			segments: [
				{ type: 'static', value: 'docs' },
				{ type: 'param', name: 'slug' },
			],
		})
		expect(parseRoutePattern('[category]/[id]')).toEqual({
			segments: [
				{ type: 'param', name: 'category' },
				{ type: 'param', name: 'id' },
			],
		})
	})

	it('treats segment with dots as static (not [.html])', () => {
		// [.x] or [.html] are not valid param names (leading .)
		expect(parseRoutePattern('foo/[.html]')).toEqual({
			segments: [
				{ type: 'static', value: 'foo' },
				{ type: 'static', value: '[.html]' },
			],
		})
	})
})

describe('isDynamicRoutePattern', () => {
	it('returns false for static patterns', () => {
		expect(isDynamicRoutePattern('about')).toBe(false)
		expect(isDynamicRoutePattern('blog/post')).toBe(false)
	})

	it('returns true when pattern has at least one param', () => {
		expect(isDynamicRoutePattern('[slug]')).toBe(true)
		expect(isDynamicRoutePattern('blog/[id]')).toBe(true)
		expect(isDynamicRoutePattern('[category]/[id]')).toBe(true)
	})
})

describe('matchRoutePattern', () => {
	it('returns null for empty or wrong segment count', () => {
		expect(matchRoutePattern('blog/[id]', 'blog')).toBeNull()
		expect(matchRoutePattern('blog/[id]', 'blog/1/extra')).toBeNull()
		expect(matchRoutePattern('[slug]', '')).toBeNull()
	})

	it('matches single param and returns decoded value', () => {
		expect(matchRoutePattern('[slug]', 'hello')).toEqual({ slug: 'hello' })
		expect(matchRoutePattern('[id]', '123')).toEqual({ id: '123' })
	})

	it('matches mixed segments and decodes param values', () => {
		expect(matchRoutePattern('blog/[id]', 'blog/123')).toEqual({ id: '123' })
		expect(matchRoutePattern('docs/[slug]', 'docs/intro')).toEqual({ slug: 'intro' })
		expect(matchRoutePattern('[category]/[id]', 'blog/post-1')).toEqual({
			category: 'blog',
			id: 'post-1',
		})
	})

	it('returns null when static segment does not match', () => {
		expect(matchRoutePattern('blog/[id]', 'docs/123')).toBeNull()
		expect(matchRoutePattern('blog/[id]', 'blog')).toBeNull()
	})
})

describe('expandRoutePattern', () => {
	it('expands single param', () => {
		expect(expandRoutePattern('[id]', { id: 'alpha' })).toBe('alpha')
	})

	it('expands multiple segments', () => {
		expect(expandRoutePattern('docs/[slug]', { slug: 'intro' })).toBe('docs/intro')
		expect(
			expandRoutePattern('[category]/[id]', { category: 'blog', id: 'post-1' }),
		).toBe('blog/post-1')
	})

	it('throws when a required param is missing', () => {
		expect(() => expandRoutePattern('[id]', {})).toThrow('missing param "id"')
		expect(() => expandRoutePattern('docs/[slug]', { id: 'x' })).toThrow(
			'missing param "slug"',
		)
	})
})
