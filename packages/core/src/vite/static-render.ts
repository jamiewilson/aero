/**
 * Static page prerender: discover pages, expand dynamic routes, render via Vite SSR, rewrite URLs.
 */

import type { AeroDirs, RedirectRule } from '../types'
import type { Plugin, ResolvedConfig } from 'vite'
import { isRunnableDevEnvironment } from 'vite'
import path from 'node:path'
import { createServer } from 'vite'
import {
	DEFAULT_API_PREFIX,
	RUNTIME_INSTANCE_MODULE_ID,
	resolveDirs,
} from './defaults'
import { readManifest } from './rewrite'
import { writeRouteManifestGenerated } from '../routing/route-manifest'
import { writeRouteTypesGenerated } from '../routing/route-typegen'
import { writeSnippetTypesGenerated } from '../snippet-typegen'
import {
	aeroStaticBuildDebug,
	resolveStaticPrerenderConcurrency,
	runPrerenderWithCancellation,
} from './static-prerender-pool'
import { writeSitemap } from './sitemap'
import { discoverPages } from './static-page-discovery'
import { expandDynamicPages } from './static-dynamic-expansion'
import {
	evaluateIncrementalGate,
	filterPagesAgainstRedirects,
	finalizeIncrementalManifest,
	selectPagesToPrerender,
} from './static-incremental-gate'
import { prerenderStaticPage } from './static-prerender-worker'

/** Options for renderStaticPages: root, dirs, resolvePath, vitePlugins, optional minify, site, redirects, resolvedConfig. */
export interface StaticBuildOptions {
	root: string
	dirs?: AeroDirs
	apiPrefix?: string
	resolvePath?: (specifier: string, importer: string) => string
	/** Plugins for the static render server. When provided, configFile is not loaded and a dedicated cacheDir is used. */
	vitePlugins?: Plugin[]
	minify?: boolean
	/** Canonical site URL (e.g. 'https://example.com'). Passed into render context as Aero.site. */
	site?: string
	/** Redirect rules; pages whose path matches a redirect `from` are not built (so only the redirect handles that path). */
	redirects?: RedirectRule[]
	/** Resolved Vite config from the main build; merged into spawn server for config parity with dev. */
	resolvedConfig?: ResolvedConfig
}

/**
 * Render all static pages into outDir: discover pages, expand dynamic routes via getStaticPaths, run Vite in middleware mode, rewrite URLs, optionally minify.
 *
 * @param options - StaticBuildOptions (root, dirs, resolvePath, vitePlugins, minify).
 * @param outDir - Output directory (e.g. dist).
 */
export async function renderStaticPages(
	options: StaticBuildOptions,
	outDir: string
): Promise<void> {
	const root = options.root
	const dirs = resolveDirs(options.dirs)
	const { manifest: routeManifest } = writeRouteManifestGenerated(root, dirs.client)
	writeRouteTypesGenerated(root, routeManifest)
	writeSnippetTypesGenerated(root)
	const apiPrefix = options.apiPrefix || DEFAULT_API_PREFIX
	const discoveredPages = discoverPages(root, path.join(dirs.client, 'pages'))
	const distDir = path.resolve(root, outDir)

	const gate = evaluateIncrementalGate({
		root,
		clientDir: dirs.client,
		distDir,
		site: options.site?.trim() ?? '',
		redirectsJson: JSON.stringify(options.redirects ?? []),
		discoveredPages,
		resolvePath: options.resolvePath,
	})

	if (gate.skipEntirePrerender) {
		aeroStaticBuildDebug('static prerender: skipped (incremental manifest match)')
		return
	}

	const manifest = readManifest(distDir)

	const previousAeroServer = process.env.AERO_SERVER
	process.env.AERO_SERVER = 'false'

	const staticCacheDir = path.join(root, '.aero', 'vite-ssr')
	const resolvedConfig = options.resolvedConfig
	const server = await createServer({
		configFile: false,
		root: resolvedConfig?.root ?? root,
		cacheDir: staticCacheDir,
		appType: 'custom',
		logLevel: 'error',
		resolve: resolvedConfig?.resolve
			? {
					alias: resolvedConfig.resolve.alias,
					conditions: resolvedConfig.resolve.conditions,
				}
			: undefined,
		define: resolvedConfig?.define,
		plugins: options.vitePlugins ?? [],
		environments: { ssr: {} },
		server: {
			middlewareMode: true,
			hmr: false,
			watch: { ignored: ['**/*'] },
		},
	})

	try {
		const tBuildStart = Date.now()
		const ssrEnv = server.environments.ssr
		if (!isRunnableDevEnvironment(ssrEnv)) {
			throw new Error('[aero] SSR environment must be runnable')
		}
		const runtime = await ssrEnv.runner.import(RUNTIME_INSTANCE_MODULE_ID)
		aeroStaticBuildDebug(
			`static prerender: runtime loaded (${Date.now() - tBuildStart}ms since build step start)`
		)

		const pages = await expandDynamicPages(discoveredPages, root, sourceFile =>
			ssrEnv.runner.import(sourceFile)
		)
		const pagesToRender = filterPagesAgainstRedirects(pages, options.redirects)
		const pagesToPrerender = selectPagesToPrerender(
			pagesToRender,
			gate,
			root,
			dirs.client,
			options.resolvePath
		)

		aeroStaticBuildDebug(
			`static prerender: ${pagesToPrerender.length} of ${pagesToRender.length} page(s) in prerender queue after route expansion (${Date.now() - tBuildStart}ms)`
		)

		const routeSet = new Set(pagesToRender.map(p => p.routePath))
		const concurrency = resolveStaticPrerenderConcurrency()
		aeroStaticBuildDebug(
			`static prerender: using concurrency ${concurrency} (set AERO_STATIC_PRERENDER_CONCURRENCY to override)`
		)

		const prerenderAbort = new AbortController()
		const onSigint = (): void => {
			prerenderAbort.abort()
		}
		process.once('SIGINT', onSigint)
		const tPrerender = Date.now()
		try {
			await runPrerenderWithCancellation({
				items: pagesToPrerender,
				concurrency,
				signal: prerenderAbort.signal,
				worker: page =>
					prerenderStaticPage({
						page,
						root,
						clientDir: dirs.client,
						distDir,
						apiPrefix,
						site: options.site,
						minifyHtml: options.minify === true,
						manifest,
						routeSet,
						runtime,
					}),
			})
		} finally {
			process.removeListener('SIGINT', onSigint)
		}

		aeroStaticBuildDebug(
			`static prerender: wrote HTML in ${Date.now() - tPrerender}ms (${pagesToPrerender.length} page(s))`
		)

		if (options.site && options.site.trim() !== '') {
			const tSite = Date.now()
			const routePaths = [...new Set(pagesToRender.map(p => p.routePath))]
			writeSitemap(routePaths, options.site.trim(), distDir)
			aeroStaticBuildDebug(`static prerender: sitemap in ${Date.now() - tSite}ms`)
		}

		finalizeIncrementalManifest(root, dirs.client, distDir, pagesToRender, gate)

		aeroStaticBuildDebug(`static prerender: total ${Date.now() - tBuildStart}ms`)
	} finally {
		await server.close()
		if (previousAeroServer === undefined) {
			delete process.env.AERO_SERVER
		} else {
			process.env.AERO_SERVER = previousAeroServer
		}
	}
}
