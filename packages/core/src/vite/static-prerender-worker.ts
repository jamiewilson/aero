/**
 * Per-page static prerender: render, rewrite URLs, optionally minify, write HTML.
 */

import type { Manifest } from 'vite'
import { minify } from 'html-minifier-next'
import fs from 'node:fs'
import path from 'node:path'
import { toPosixRelative } from '../utils/path'
import { addDoctype, rewriteRenderedHtml } from './rewrite'
import { isDynamicPage, type StaticPage } from './static-page-discovery'

export interface PrerenderPageWorkerArgs {
	page: StaticPage
	root: string
	clientDir: string
	distDir: string
	apiPrefix: string
	site: string | undefined
	minifyHtml: boolean
	manifest: Manifest
	routeSet: Set<string>
	/** Runtime with `aero.render` (from SSR runner import of runtime instance). */
	runtime: { aero: { render: (target: string, input: Record<string, unknown>) => Promise<string> } }
}

/** Render one static page to distDir. */
export async function prerenderStaticPage(args: PrerenderPageWorkerArgs): Promise<void> {
	const {
		page,
		root,
		clientDir,
		distDir,
		apiPrefix,
		site,
		minifyHtml,
		manifest,
		routeSet,
		runtime,
	} = args

	const routePath = page.routePath ? `/${page.routePath}` : '/'
	const pageUrl = new URL(routePath, 'http://localhost')

	// For expanded dynamic pages we must render via the original
	// dynamic page name (e.g. "[id]") so the runtime finds the module,
	// while passing the concrete params so the template has real values.
	const renderTarget = isDynamicPage(page)
		? toPosixRelative(
				path.resolve(page.sourceFile),
				path.resolve(root, clientDir, 'pages')
			).replace(/\.html$/i, '')
		: page.pageName

	let rendered = await runtime.aero.render(renderTarget, {
		url: pageUrl,
		request: new Request(pageUrl.toString(), { method: 'GET' }),
		routePath,
		params: page.params || {},
		props: page.props || {},
		site,
	})
	rendered = rewriteRenderedHtml(
		addDoctype(rendered),
		page.outputFile,
		manifest,
		routeSet,
		apiPrefix
	)

	const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD
	if (minifyHtml && isProd) {
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
}
