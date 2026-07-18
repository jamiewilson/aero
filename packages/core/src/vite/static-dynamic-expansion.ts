/**
 * Expand dynamic pages via getStaticPaths into concrete StaticPage entries.
 */

import path from 'node:path'
import type { StaticPathEntry } from '../types'
import { toOutputFile } from './rewrite'
import {
	expandPattern,
	isDynamicPage,
	toRouteFromPageName,
	type StaticPage,
} from './static-page-discovery'

/** Module shape loaded from the SSR runner for a page source file. */
export interface StaticPageModule {
	getStaticPaths?: () => StaticPathEntry[] | Promise<StaticPathEntry[]>
}

/**
 * Expand discovered pages: static pages pass through; dynamic pages expand via getStaticPaths.
 *
 * @param importPage - Load a compiled page module (typically SSR runner.import).
 */
export async function expandDynamicPages(
	discoveredPages: readonly StaticPage[],
	root: string,
	importPage: (sourceFile: string) => Promise<StaticPageModule>
): Promise<StaticPage[]> {
	const pages: StaticPage[] = []
	for (const page of discoveredPages) {
		if (!isDynamicPage(page)) {
			pages.push(page)
			continue
		}

		const mod = await importPage(page.sourceFile)
		if (typeof mod.getStaticPaths !== 'function') {
			console.warn(
				`[aero] ⚠ Skipping dynamic page "${path.relative(root, page.sourceFile)}" — ` +
					`no getStaticPaths() exported. Page will not be pre-rendered.`
			)
			continue
		}

		const staticPaths: StaticPathEntry[] = await mod.getStaticPaths()
		if (!Array.isArray(staticPaths) || staticPaths.length === 0) {
			console.warn(
				`[aero] ⚠ getStaticPaths() for "${path.relative(root, page.sourceFile)}" ` +
					`returned no paths. Page will not be pre-rendered.`
			)
			continue
		}

		for (const entry of staticPaths) {
			const expandedPageName = expandPattern(page.pageName, entry.params)
			const expandedRoute = toRouteFromPageName(expandedPageName)
			pages.push({
				pageName: expandedPageName,
				routePath: expandedRoute,
				sourceFile: page.sourceFile,
				outputFile: toOutputFile(expandedRoute),
				params: entry.params,
				props: entry.props,
			})
		}
	}
	return pages
}
