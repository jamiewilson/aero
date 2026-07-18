/**
 * Static page prerender: discover pages, expand dynamic routes, render via Vite SSR, rewrite URLs.
 */

import type { AeroDirs, RedirectRule, StaticPathEntry } from '../types'
import type { Plugin, ResolvedConfig } from 'vite'
import { isRunnableDevEnvironment } from 'vite'
import { minify } from 'html-minifier-next'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import {
	DEFAULT_API_PREFIX,
	RUNTIME_INSTANCE_MODULE_ID,
	resolveDirs,
} from './defaults'
import {
	addDoctype,
	readManifest,
	rewriteRenderedHtml,
	toOutputFile,
} from './rewrite'
import {
	AERO_BUILD_MANIFEST_VERSION,
	canSkipEntirePrerender,
	computeClientHtmlFingerprint,
	diffTemplateFileHashes,
	hashStaticBuildOptions,
	hashViteOutputManifest,
	isIncrementalStaticBuildEnabled,
	readBuildManifest,
	writeBuildManifest,
} from './build-manifest'
import { writeRouteManifestGenerated } from '../routing/route-manifest'
import { writeRouteTypesGenerated } from '../routing/route-typegen'
import { writeSnippetTypesGenerated } from '../snippet-typegen'
import { toPosixRelative } from '../utils/path'
import {
	aeroStaticBuildDebug,
	resolveStaticPrerenderConcurrency,
	runPrerenderWithCancellation,
} from './static-prerender-pool'
import { writeSitemap } from './sitemap'
import {
	discoverPages,
	expandPattern,
	isDynamicPage,
	toRouteFromPageName,
	trimEdgeSlashes,
	type StaticPage,
} from './static-page-discovery'
import {
	collectTransitiveTemplateImports,
	computeTemplateFileHashesMap,
	getResolvePathForProject,
} from './template-import-closure'

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
	// Pages are always discovered from the client/pages subtree.
	const discoveredPages = discoverPages(root, path.join(dirs.client, 'pages'))
	const distDir = path.resolve(root, outDir)

	const prevBuildManifest = readBuildManifest(root)
	const viteManifestHashForIncremental = hashViteOutputManifest(distDir)
	const clientHtmlFingerprint = computeClientHtmlFingerprint(root, dirs.client)
	const staticBuildOptionsHash = hashStaticBuildOptions(
		options.site?.trim() ?? '',
		JSON.stringify(options.redirects ?? [])
	)
	const templateFileHashesCurrent = computeTemplateFileHashesMap(root, dirs.client)
	const hasDynamicRoutes = discoveredPages.some(p => isDynamicPage(p))

	if (isIncrementalStaticBuildEnabled() && hasDynamicRoutes) {
		aeroStaticBuildDebug(
			'static prerender: incremental whole-phase skip disabled (dynamic [param] page(s) present; getStaticPaths must run each build)'
		)
	}

	if (
		isIncrementalStaticBuildEnabled() &&
		!hasDynamicRoutes &&
		canSkipEntirePrerender({
			previous: prevBuildManifest,
			currentViteManifestHash: viteManifestHashForIncremental,
			currentClientHtmlFingerprint: clientHtmlFingerprint,
			currentStaticBuildOptionsHash: staticBuildOptionsHash,
		})
	) {
		aeroStaticBuildDebug('static prerender: skipped (incremental manifest match)')
		return
	}

	const manifest = readManifest(distDir)

	// Disable Nitro plugin during static page rendering to prevent it from handling
	// requests or starting watchers that might hang the build.
	const previousAeroServer = process.env.AERO_SERVER
	process.env.AERO_SERVER = 'false'

	// Use a dedicated cache dir so the static server does not reuse the main build's
	// transform cache (which would hand compiled .html→JS to import-analysis and fail).
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

		// Expand dynamic pages via getStaticPaths before rendering.
		const pages: StaticPage[] = []
		for (const page of discoveredPages) {
			if (!isDynamicPage(page)) {
				pages.push(page)
				continue
			}

			// Load the compiled module to check for getStaticPaths export
			const mod = await ssrEnv.runner.import(page.sourceFile)
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

		// Skip building pages that are redirect sources so the Nitro routeRule is the only handler.
		const redirectFromSet = new Set(
			(options.redirects ?? []).map(r => trimEdgeSlashes(r.from).trim() || '')
		)
		const pathMatchesRedirect = (page: StaticPage): boolean => {
			const pathSegment = page.routePath === '' ? '' : page.routePath
			return redirectFromSet.has(pathSegment)
		}
		const pagesToRender = options.redirects?.length
			? pages.filter(p => !pathMatchesRedirect(p))
			: pages

		let pagesToPrerender = pagesToRender
		if (
			isIncrementalStaticBuildEnabled() &&
			!hasDynamicRoutes &&
			prevBuildManifest &&
			prevBuildManifest.templateFileHashes &&
			prevBuildManifest.viteManifestHash === viteManifestHashForIncremental &&
			prevBuildManifest.staticBuildOptionsHash === staticBuildOptionsHash
		) {
			const changed = diffTemplateFileHashes(
				prevBuildManifest.templateFileHashes,
				templateFileHashesCurrent
			)
			if (changed.length > 0) {
				const resolvePath = getResolvePathForProject(root, options.resolvePath)
				const dirty: StaticPage[] = []
				for (const page of pagesToRender) {
					const closure = collectTransitiveTemplateImports(
						root,
						dirs.client,
						resolvePath,
						page.sourceFile
					)
					let needs = false
					for (const c of changed) {
						if (closure.has(c)) {
							needs = true
							break
						}
					}
					if (needs) dirty.push(page)
				}
				if (dirty.length === 0) {
					aeroStaticBuildDebug(
						'static prerender: incremental partial — no page depends on changed template(s); skipping HTML writes'
					)
					pagesToPrerender = []
				} else if (dirty.length < pagesToRender.length) {
					pagesToPrerender = dirty
					aeroStaticBuildDebug(
						`static prerender: incremental partial (${dirty.length} of ${pagesToRender.length} page(s))`
					)
				}
			}
		}

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
				worker: async page => {
					const routePath = page.routePath ? `/${page.routePath}` : '/'
					const pageUrl = new URL(routePath, 'http://localhost')

					// For expanded dynamic pages we must render via the original
					// dynamic page name (e.g. "[id]") so the runtime finds the module,
					// while passing the concrete params so the template has real values.
					const renderTarget = isDynamicPage(page)
						? toPosixRelative(
								path.resolve(page.sourceFile),
								path.resolve(root, dirs.client, 'pages')
							).replace(/\.html$/i, '')
						: page.pageName

					let rendered = await runtime.aero.render(renderTarget, {
						url: pageUrl,
						request: new Request(pageUrl.toString(), { method: 'GET' }),
						routePath,
						params: page.params || {},
						props: page.props || {},
						site: options.site,
					})
					rendered = rewriteRenderedHtml(
						addDoctype(rendered),
						page.outputFile,
						manifest,
						routeSet,
						apiPrefix
					)

					const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD
					if (options.minify && isProd) {
						rendered = await minify(rendered, {
							collapseWhitespace: true,
							removeComments: true,
							minifyCSS: true,
							minifyJS: true,
						})
					}

					const outPath = path.join(distDir, page.outputFile)
					fs.mkdirSync(path.dirname(outPath), { recursive: true })
					fs.writeFileSync(outPath, rendered, 'utf-8')
				},
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

		if (isIncrementalStaticBuildEnabled()) {
			const produced = new Set(pagesToRender.map(p => p.outputFile))
			if (prevBuildManifest) {
				for (const entry of Object.values(prevBuildManifest.pages)) {
					if (!produced.has(entry.outputFile)) {
						const stale = path.join(distDir, entry.outputFile)
						if (fs.existsSync(stale)) fs.unlinkSync(stale)
					}
				}
			}
			writeBuildManifest(root, {
				version: AERO_BUILD_MANIFEST_VERSION,
				generatedAt: new Date().toISOString(),
				viteManifestHash: hashViteOutputManifest(distDir) ?? '',
				clientHtmlFingerprint: computeClientHtmlFingerprint(root, dirs.client),
				staticBuildOptionsHash,
				templateFileHashes: templateFileHashesCurrent,
				pages: Object.fromEntries(
					pagesToRender.map(p => [p.routePath, { outputFile: p.outputFile }])
				),
			})
		}

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
