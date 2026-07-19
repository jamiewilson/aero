/**
 * Static page discovery: page names, route paths, and output files from client/pages.
 */

import path from 'node:path'
import { pagePathToKey, pageNameToRelativeRoutePath } from '../utils/routing'
import { isDynamicRoutePattern, expandRoutePattern } from '../utils/route-pattern'
import { toPosixRelative } from '../utils/path'
import { toOutputFile } from './rewrite'
import { walkHtmlFiles } from '../utils/fs-walk'

/** One page to render: pageName (e.g. index or posts/[id]), routePath, source/output paths, optional params/props for dynamic pages. */
export interface StaticPage {
	pageName: string
	routePath: string
	sourceFile: string
	outputFile: string
	params?: Record<string, string>
	props?: Record<string, any>
}

/** True if page has dynamic segments (e.g. `posts/[id]`). */
export function isDynamicPage(page: StaticPage): boolean {
	return isDynamicRoutePattern(page.pageName)
}

/** @deprecated Use {@link expandRoutePattern} from `utils/route-pattern`. */
export const expandPattern = expandRoutePattern

/** Trim leading/trailing slashes for redirect path matching. */
export function trimEdgeSlashes(value: string): string {
	let start = 0
	let end = value.length
	while (start < end && value[start] === '/') start++
	while (end > start && value[end - 1] === '/') end--
	return value.slice(start, end)
}

/** @deprecated Use {@link pageNameToRelativeRoutePath} from `utils/routing`. */
export const toRouteFromPageName = pageNameToRelativeRoutePath

/** Static pages from pagesRoot: file paths, page names (via pagePathToKey), route paths, output files; home → index when no sibling index. */
export function discoverPages(root: string, pagesRoot: string): StaticPage[] {
	const pagesDir = path.resolve(root, pagesRoot)
	const pageFiles = walkHtmlFiles(pagesDir)

	// Use same key derivation as runtime (pagePathToKey) so page names align.
	const allPageNames = new Set(pageFiles.map(f => pagePathToKey(toPosixRelative(f, root))))

	return pageFiles.map(file => {
		const relFromRoot = toPosixRelative(file, root)
		let pageName = pagePathToKey(relFromRoot)

		// Mirror the runtime fallback: treat home as index when there is no
		// explicit index.html at the same directory level.
		if (pageName === 'home' && !allPageNames.has('index')) {
			pageName = 'index'
		} else if (pageName.endsWith('/home')) {
			const siblingIndex = pageName.slice(0, -'/home'.length) + '/index'
			if (!allPageNames.has(siblingIndex)) {
				pageName = siblingIndex
			}
		}

		const routePath = pageNameToRelativeRoutePath(pageName)
		return {
			pageName,
			routePath,
			sourceFile: file,
			outputFile: toOutputFile(routePath),
		}
	})
}
