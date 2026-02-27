/**
 * Resolve a request URL path to an Aero page name for runtime/Vite lookup.
 * Page key derivation and page/module resolution for runtime and build.
 *
 * Used by the Vite dev server middleware and static build to map incoming paths
 * (e.g. `/about`, `/blog/post`) to the page module key (e.g. `about`, `blog/post`).
 * Strips query and hash; trailing slash becomes `/index` → `blog/index`.
 *
 * @packageDocumentation
 */

import type { AeroRouteParams } from '../types'
import { toPosix } from './path'
import { matchRoutePattern } from './route-pattern'

/**
 * Result of resolving a page: the module (or lazy loader), canonical page name, and route params.
 */
export interface PageTargetResult {
	module: any
	pageName: string
	params: AeroRouteParams
}

/**
 * Derives a canonical page key from a resolved file path (e.g. from import.meta.glob).
 * Used by the runtime when registering pages so lookup keys match build's page names.
 *
 * - Paths containing `pages/`: key is the segment after `pages/` (e.g. `client/pages/about.html` → `about`).
 * - Multiple segments without `pages/` (e.g. layouts, components): key is full path without extension.
 * - Single segment: key is that segment.
 *
 * @param path - Resolved path (with or without `.html`).
 * @returns Canonical key for pagesMap lookup.
 */
export function pagePathToKey(path: string): string {
	const withoutExt = toPosix(path).replace(/\.html$/i, '')
	if (withoutExt.includes('pages/')) {
		return withoutExt.split('pages/').pop()!
	}
	const segments = withoutExt.split('/').filter(Boolean)
	if (segments.length > 1) {
		return segments.join('/')
	}
	return segments.pop() || path
}

/**
 * Resolves a URL path to an Aero page name.
 *
 * @param url - Full URL or path (e.g. `/about`, `/about?foo=bar`, `/blog/`).
 * @returns Page name for lookup in pagesMap (e.g. `index`, `about`, `blog/index`, `blog/post`).
 *
 * @example
 * resolvePageName('/') // 'index'
 * resolvePageName('/about') // 'about'
 * resolvePageName('/about.html') // 'about'
 * resolvePageName('/blog/') // 'blog/index'
 * resolvePageName('/blog/post') // 'blog/post'
 * resolvePageName('/about?foo=bar') // 'about'
 */
export function resolvePageName(url: string): string {
	const [pathPart] = url.split('?')
	let clean = pathPart || '/'

	if (clean === '/' || clean === '') return 'index'

	// If it ends with a slash, treat as /foo/ -> foo/index
	if (clean.endsWith('/')) {
		clean = clean + 'index'
	}

	clean = clean.replace(/^\//, '')
	clean = clean.replace(/\.html$/, '')

	return clean || 'index'
}

/**
 * Matches a page name (e.g. `posts/42`) against registered dynamic routes (e.g. `posts/[id]`).
 * Returns the first matching module, its canonical page name, and extracted params.
 *
 * @param pageName - Requested page name (e.g. `blog/123`).
 * @param pagesMap - Map of page key → module (from registerPages).
 * @returns PageTargetResult or null if no match.
 */
export function resolveDynamicPage(
	pageName: string,
	pagesMap: Record<string, any>,
): PageTargetResult | null {
	for (const [key, mod] of Object.entries(pagesMap)) {
		if (!key.includes('[') || !key.includes(']') || key.includes('.')) continue
		const params = matchRoutePattern(key, pageName)
		if (params != null) {
			return { module: mod, pageName: key, params }
		}
	}
	return null
}

/**
 * Resolves a component (page name string or module) to a page target for rendering.
 * Implements the same lookup order as the runtime: direct key, directory index, home fallback,
 * dynamic routes, then trailing-slash stripping.
 *
 * @param component - Page name (e.g. `'index'`, `'about'`) or a module object.
 * @param pagesMap - Map of page key → module (from registerPages).
 * @returns PageTargetResult or null if not found.
 */
export function resolvePageTarget(
	component: any,
	pagesMap: Record<string, any>,
): PageTargetResult | null {
	if (typeof component !== 'string') {
		return component != null ? { module: component, pageName: 'index', params: {} } : null
	}

	const pageName = component
	let target = pagesMap[pageName]

	if (!target) {
		target = pagesMap[`${pageName}/index`]
	}
	if (!target && pageName === 'index') {
		target = pagesMap['home']
	}
	if (!target) {
		const dynamicMatch = resolveDynamicPage(pageName, pagesMap) ?? resolveDynamicPage(`${pageName}/index`, pagesMap)
		if (dynamicMatch) return dynamicMatch
	}

	// Trailing-slash: resolvePageName gives "foo/index"; try "foo" and dynamic "foo"
	if (!target && pageName.endsWith('/index')) {
		const stripped = pageName.slice(0, -'/index'.length)
		target = pagesMap[stripped]
		if (target) return { module: target, pageName: stripped, params: {} }
		const dynamicMatch = resolveDynamicPage(stripped, pagesMap)
		if (dynamicMatch) return dynamicMatch
	}

	if (!target) return null
	return { module: target, pageName, params: {} }
}
