/**
 * Static build: page discovery, client script discovery, HTML rendering, and URL rewriting.
 *
 * @remarks
 * Used after Vite's main bundle (closeBundle). Discovers pages from client/pages, expands dynamic
 * routes via getStaticPaths, runs a minimal Vite server in middleware mode to render each page,
 * rewrites virtual script URLs and absolute hrefs/src to dist-relative paths using the manifest,
 * and optionally minifies HTML. Also provides createBuildConfig for Rollup inputs and discoverClientScriptContentMap for the plugin.
 */

import type { AeroDirs, RedirectRule, ScriptEntry, StaticPathEntry, ParseResult } from '../types'

import type { Plugin, ResolvedConfig, UserConfig } from 'vite'
import { isRunnableDevEnvironment } from 'vite'
import { minify } from 'html-minifier-next'
import fs from 'node:fs'
import path from 'node:path'
import { parseHTML } from 'linkedom'
import { parse } from '../compiler/parser'
import { pagePathToKey } from '../utils/routing'
import { expandRoutePattern, isDynamicRoutePattern } from '../utils/route-pattern'
import { createServer } from 'vite'

import {
	DEFAULT_API_PREFIX,
	getClientScriptVirtualUrl,
	RUNTIME_INSTANCE_MODULE_ID,
	resolveDirs,
	SKIP_PROTOCOL_REGEX,
} from './defaults'

import {
	addDoctype,
	normalizeRelativeLink,
	normalizeRelativeRouteLink,
	readManifest,
	rewriteAbsoluteUrl,
	rewriteRenderedHtml,
	toOutputFile,
} from './rewrite'

import { toPosix, toPosixRelative } from '../utils/path'

export { addDoctype } from './rewrite'

/**
 * Register client scripts from parsed template into a Map.
 * Converts client script content to virtual URLs for Vite bundling.
 */
export function registerClientScriptsToMap(
	parsed: ParseResult,
	baseName: string,
	target: Map<string, ScriptEntry>
): void {
	const total = parsed.clientScripts.length
	for (let i = 0; i < total; i++) {
		const clientScript = parsed.clientScripts[i]
		const clientScriptUrl = getClientScriptVirtualUrl(baseName, i, total)
		target.set(clientScriptUrl, {
			content: clientScript.content,
			passDataExpr: clientScript.passDataExpr,
			injectInHead: clientScript.injectInHead,
		})
	}
}

/** Options for renderStaticPages: root, dirs, resolvePath, vitePlugins, optional minify, site, redirects, resolvedConfig. */
interface StaticBuildOptions {
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

/** One page to render: pageName (e.g. index or posts/[id]), routePath, source/output paths, optional params/props for dynamic pages. */
interface StaticPage {
	pageName: string
	routePath: string
	sourceFile: string
	outputFile: string
	params?: Record<string, string>
	props?: Record<string, any>
}

/** True if page has dynamic segments (e.g. `posts/[id]`). */
function isDynamicPage(page: StaticPage): boolean {
	return isDynamicRoutePattern(page.pageName)
}

/** Replace `[key]` in pattern with params[key]; throws if a key is missing. */
function expandPattern(pattern: string, params: Record<string, string>): string {
	return expandRoutePattern(pattern, params)
}

/** Recursively collect all .html file paths under dir. */
function walkHtmlFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return []
	const files: string[] = []
	for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, item.name)
		if (item.isDirectory()) {
			files.push(...walkHtmlFiles(fullPath))
			continue
		}
		if (item.isFile() && item.name.endsWith('.html')) {
			files.push(fullPath)
		}
	}
	return files
}

/** Page name to route path (e.g. index → '', about → about, blog/index → blog). */
function toRouteFromPageName(pageName: string): string {
	if (pageName === 'index') return ''
	if (pageName.endsWith('/index')) return pageName.slice(0, -'/index'.length)
	return pageName
}

/**
 * Generate sitemap.xml from route paths. Only called when site URL is set.
 * Excludes 404. Writes to distDir/sitemap.xml.
 */
function writeSitemap(routePaths: string[], site: string, distDir: string): void {
	const base = site.replace(/\/$/, '')
	const urls = routePaths
		.filter(r => r !== '404')
		.map(routePath => {
			const pathSegment = routePath === '' ? '' : `/${routePath}/`
			const loc = `${base}${pathSegment || '/'}`
			return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`
		})
	const xml =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		urls.join('\n') +
		'\n</urlset>\n'
	fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf-8')
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

/** Root-relative path for manifest key (posix). */
function toManifestKey(root: string, filePath: string): string {
	return toPosixRelative(filePath, root)
}

/** True if URL is empty or matches SKIP_PROTOCOL_REGEX (external, hash, etc.). */
function isSkippableUrl(value: string): boolean {
	if (!value) return true
	return SKIP_PROTOCOL_REGEX.test(value)
}

/** Resolve script/link src or href to absolute path; returns null for external/skippable or unresolvable. */
function resolveTemplateAssetPath(
	rawValue: string,
	templateFile: string,
	root: string,
	resolvePath?: (specifier: string, importer: string) => string
): string | null {
	if (!rawValue || isSkippableUrl(rawValue)) return null
	if (rawValue.startsWith('/')) return path.resolve(root, rawValue.slice(1))
	if (rawValue.startsWith('@') || rawValue.startsWith('~')) {
		const resolved = resolvePath ? resolvePath(rawValue, templateFile) : rawValue
		return path.isAbsolute(resolved) ? resolved : path.resolve(root, resolved)
	}
	if (rawValue.startsWith('./') || rawValue.startsWith('../')) {
		return path.resolve(path.dirname(templateFile), rawValue)
	}
	return null
}

/** All .html files under root/templateRoot (recursive). */
function discoverTemplates(root: string, templateRoot: string): string[] {
	return walkHtmlFiles(path.resolve(root, templateRoot))
}

/** Static pages from pagesRoot: file paths, page names (via pagePathToKey), route paths, output files; home → index when no sibling index. */
function discoverPages(root: string, pagesRoot: string): StaticPage[] {
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

		const routePath = toRouteFromPageName(pageName)
		return {
			pageName,
			routePath,
			sourceFile: file,
			outputFile: toOutputFile(routePath),
		}
	})
}

/**
 * Discover all extracted client scripts from templates under root/templateRoot.
 *
 * @param root - Project root.
 * @param templateRoot - Directory under root containing .html templates (e.g. client).
 * @returns Map from virtual URL (e.g. `/@aero/client/client/pages/home.js`) to ScriptEntry.
 */
export function discoverClientScriptContentMap(
	root: string,
	templateRoot: string
): Map<string, ScriptEntry> {
	const map = new Map<string, ScriptEntry>()
	for (const file of discoverTemplates(root, templateRoot)) {
		const source = fs.readFileSync(file, 'utf-8')
		const parsed = parse(source)
		if (parsed.clientScripts.length === 0) continue
		const rel = toPosixRelative(file, root)
		const baseName = rel.replace(/\.html$/i, '')
		registerClientScriptsToMap(parsed, baseName, map)
	}
	return map
}

/** Rollup input entries for virtual client scripts (manifest key → virtual path); used by createBuildConfig. */
function discoverClientScriptVirtualInputs(
	root: string,
	templateRoot: string
): Record<string, string> {
	const entries: Record<string, string> = {}
	for (const file of discoverTemplates(root, templateRoot)) {
		const source = fs.readFileSync(file, 'utf-8')
		const parsed = parse(source)
		if (parsed.clientScripts.length === 0) continue
		const rel = toPosixRelative(file, root)
		const baseName = rel.replace(/\.html$/i, '')
		const { clientScripts } = parsed
		const total = clientScripts.length
		for (let i = 0; i < total; i++) {
			const virtualPath = getClientScriptVirtualUrl(baseName, i, total)
			const manifestKey = virtualPath.replace(/^\//, '')
			entries[manifestKey] = virtualPath
		}
	}
	return entries
}

/** Rollup input entries: script/link refs from templates, default client index, and assets/images. */
function discoverAssetInputs(
	root: string,
	resolvePath?: (specifier: string, importer: string) => string,
	templateRoot = 'client'
): Record<string, string> {
	const entries = new Map<string, string>()
	for (const templateFile of discoverTemplates(root, templateRoot)) {
		const source = fs.readFileSync(templateFile, 'utf-8')
		const { document } = parseHTML(source)
		const scripts = Array.from(document.querySelectorAll('script[src]'))
		const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
		const refs = [...scripts, ...styles]

		for (const el of refs) {
			const attr = el.hasAttribute('src') ? 'src' : 'href'
			const raw = el.getAttribute(attr) || ''
			const resolved = resolveTemplateAssetPath(raw, templateFile, root, resolvePath)
			if (!resolved || !fs.existsSync(resolved)) continue
			const ext = path.extname(resolved).toLowerCase()
			if (!['.js', '.mjs', '.ts', '.tsx', '.css'].includes(ext)) continue
			entries.set(toManifestKey(root, resolved), resolved)
		}
	}

	// Keep build resilient when templates do not declare script/style entries.
	const defaultClientEntry = path.resolve(root, `${templateRoot}/index.ts`)
	if (fs.existsSync(defaultClientEntry)) {
		entries.set(toManifestKey(root, defaultClientEntry), defaultClientEntry)
	}

	// Add all assets from the images directory to ensure they are processed
	// and added to the manifest, even if only referenced in SSR.
	const imagesDir = path.resolve(root, templateRoot, 'assets/images')
	if (fs.existsSync(imagesDir)) {
		const imageFiles = walkFiles(imagesDir)
		for (const file of imageFiles) {
			// Skip files that are already added (e.g. via HTML scan)
			const key = toManifestKey(root, file)
			if (entries.has(key)) continue

			// Start with basic image/font extensions, or just include everything not hidden
			if (path.basename(file).startsWith('.')) continue

			entries.set(key, file)
		}
	}

	return Object.fromEntries(entries)
}

/** Recursively collect all file paths under dir (no extension filter). */
function walkFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return []
	const files: string[] = []
	for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, item.name)
		if (item.isDirectory()) {
			files.push(...walkFiles(fullPath))
			continue
		}
		if (item.isFile()) {
			files.push(fullPath)
		}
	}
	return files
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
	const apiPrefix = options.apiPrefix || DEFAULT_API_PREFIX
	// Pages are always discovered from the client/pages subtree.
	const discoveredPages = discoverPages(root, path.join(dirs.client, 'pages'))
	const distDir = path.resolve(root, outDir)
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
		const ssrEnv = server.environments.ssr
		if (!isRunnableDevEnvironment(ssrEnv)) {
			throw new Error('[aero] SSR environment must be runnable')
		}
		const runtime = await ssrEnv.runner.import(RUNTIME_INSTANCE_MODULE_ID)

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
			(options.redirects ?? []).map(r => r.from.replace(/^\/+|\/+$/g, '').trim() || '')
		)
		const pathMatchesRedirect = (page: StaticPage): boolean => {
			const pathSegment = page.routePath === '' ? '' : page.routePath
			return redirectFromSet.has(pathSegment)
		}
		const pagesToRender = options.redirects?.length
			? pages.filter(p => !pathMatchesRedirect(p))
			: pages

		const routeSet = new Set(pagesToRender.map(p => p.routePath))

		for (const page of pagesToRender) {
			const routePath = page.routePath ? `/${page.routePath}` : '/'
			const pageUrl = new URL(routePath, 'http://localhost')

			// For expanded dynamic pages we must render via the original
			// dynamic page name (e.g. "[id]") so the runtime finds the module,
			// while passing the concrete params so the template has real values.
			const renderTarget = isDynamicPage(page)
				? toPosixRelative(page.sourceFile, path.resolve(root, dirs.client, 'pages')).replace(
						/\.html$/i,
						''
					)
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

			// Minify HTML in production
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
		}

		if (options.site && options.site.trim() !== '') {
			const routePaths = [...new Set(pagesToRender.map(p => p.routePath))]
			writeSitemap(routePaths, options.site.trim(), distDir)
		}
	} finally {
		await server.close()
		if (previousAeroServer === undefined) {
			delete process.env.AERO_SERVER
		} else {
			process.env.AERO_SERVER = previousAeroServer
		}
	}
}

interface BuildConfigOptions {
	dirs?: AeroDirs
	resolvePath?: (specifier: string, importer: string) => string
}

/**
 * Vite build config: outDir, manifest, emptyOutDir, rollupOptions.input from discovered assets and virtual client scripts.
 *
 * @param options - Optional dirs and resolvePath for asset discovery.
 * @param root - Project root (default process.cwd()).
 * @returns Vite UserConfig.build fragment.
 */
export function createBuildConfig(
	options: BuildConfigOptions = {},
	root = process.cwd()
): UserConfig['build'] {
	const dirs = resolveDirs(options.dirs)
	const assetInputs = discoverAssetInputs(root, options.resolvePath, dirs.client)
	const virtualClientInputs = discoverClientScriptVirtualInputs(root, dirs.client)
	const inputs = { ...assetInputs, ...virtualClientInputs }
	return {
		outDir: dirs.dist,
		manifest: true,
		emptyOutDir: true,
		rollupOptions: {
			input: inputs,
			output: {
				entryFileNames(chunkInfo) {
					const name = path.basename(chunkInfo.name)
					return `assets/${name}-[hash].js`
				},
				chunkFileNames(chunkInfo) {
					// Facade chunks for aero-html templates only re-export from the real content chunk.
					// Name them aero-[hash].js so they don't collide with the content chunk (e.g. badge-[hash].js).
					const facade = chunkInfo.facadeModuleId ?? ''
					if (facade.includes('aero-html')) {
						return `assets/aero-[hash].js`
					}
					const name = path.basename(chunkInfo.name)
					return `assets/${name}-[hash].js`
				},
				assetFileNames(assetInfo) {
					const name = path.basename(assetInfo.name || '')
					return `assets/${name}-[hash][extname]`
				},
			},
		},
	}
}

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
}
