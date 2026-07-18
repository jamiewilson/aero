/**
 * Static build: page discovery, client script discovery, HTML rendering, and URL rewriting.
 *
 * @remarks
 * Barrel re-exporting focused modules. Used after Vite's main bundle (closeBundle).
 */

export { addDoctype } from './rewrite'

export {
	aeroStaticBuildDebug,
	resolveStaticPrerenderConcurrency,
	runPrerenderWithCancellation,
} from './static-prerender-pool'

export { writeSitemap } from './sitemap'

export {
	walkFiles,
	walkFilesRecursive,
	walkHtmlFiles,
	walkHtmlFilesDirectOnly,
} from './template-walk'

export {
	discoverReactivePagePaths,
	discoverRuntimeTemplatePaths,
} from './runtime-template-discovery'

export {
	discoverPages,
	expandPattern,
	isDynamicPage,
	toRouteFromPageName,
	trimEdgeSlashes,
	type StaticPage,
} from './static-page-discovery'

export {
	collectTransitiveTemplateImports,
	computeTemplateFileHashesMap,
	getResolvePathForProject,
} from './template-import-closure'

export { getRuntimeInstanceModuleSource } from './runtime-instance-module'

export {
	TemplateDiscovery,
	createBuildConfig,
	discoverClientScriptContentMap,
	registerClientScriptsToMap,
} from './rollup-input-discovery'

export { renderStaticPages, type StaticBuildOptions } from './static-render'

import {
	normalizeRelativeLink,
	normalizeRelativeRouteLink,
	rewriteAbsoluteUrl,
	rewriteRenderedHtml,
	toOutputFile,
} from './rewrite'
import {
	resolveStaticPrerenderConcurrency,
	runPrerenderWithCancellation,
} from './static-prerender-pool'
import { writeSitemap } from './sitemap'
import {
	discoverPages,
	expandPattern,
	isDynamicPage,
	trimEdgeSlashes,
} from './static-page-discovery'

export const __internal = {
	toOutputFile,
	normalizeRelativeLink,
	normalizeRelativeRouteLink,
	rewriteAbsoluteUrl,
	rewriteRenderedHtml,
	isDynamicPage,
	expandPattern,
	discoverPages,
	writeSitemap,
	resolveStaticPrerenderConcurrency,
	runPrerenderWithCancellation,
	trimEdgeSlashes,
}
