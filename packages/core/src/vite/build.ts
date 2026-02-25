/**
 * Static build: page discovery, client script discovery, HTML rendering, and URL rewriting.
 *
 * @remarks
 * Used after Vite's main bundle (closeBundle). Discovers pages from client/pages, expands dynamic
 * routes via getStaticPaths, runs a minimal Vite server in middleware mode to render each page,
 * rewrites virtual script URLs and absolute hrefs/src to dist-relative paths using the manifest,
 * and optionally minifies HTML. Also provides createBuildConfig for Rollup inputs and discoverClientScriptContentMap for the plugin.
 */

import type {
	AeroDirs,
	RedirectRule,
	ScriptEntry,
	StaticPathEntry,
	ParseResult,
} from '../types'

import type { Manifest, Plugin, UserConfig } from 'vite'
import { minify as minifyHTML } from 'html-minifier-next'
import fs from 'node:fs'
import path from 'node:path'
import { parseHTML } from 'linkedom'
import { parse } from '../compiler/parser'
import { pagePathToKey } from '../utils/routing'
import { createServer } from 'vite'

import {
	CLIENT_SCRIPT_PREFIX,
	DEFAULT_API_PREFIX,
	getClientScriptVirtualUrl,
	LINK_ATTRS,
	RUNTIME_INSTANCE_MODULE_ID,
	SKIP_PROTOCOL_REGEX,
	resolveDirs,
} from './defaults'

import { toPosix, toPosixRelative } from '../utils/path'

/**
 * Register client scripts from parsed template into a Map.
 * Converts client script content to virtual URLs for Vite bundling.
 */
export function registerClientScriptsToMap(
	parsed: ParseResult,
	baseName: string,
	target: Map<string, ScriptEntry>,
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

/** Options for renderStaticPages: root, dirs, resolvePath, vitePlugins, optional minify, site, redirects. */
interface StaticBuildOptions {
	root: string
	dirs?: AeroDirs
	apiPrefix?: string
	resolvePath?: (specifier: string) => string
	/** Plugins for the static render server. When provided, configFile is not loaded and a dedicated cacheDir is used. */
	vitePlugins?: Plugin[]
	minify?: boolean
	/** Canonical site URL (e.g. 'https://example.com'). Passed into render context as Aero.site. */
	site?: string
	/** Redirect rules; pages whose path matches a redirect `from` are not built (so only the redirect handles that path). */
	redirects?: RedirectRule[]
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
	return /\[.+?\]/.test(page.pageName)
}

/** Replace `[key]` in pattern with params[key]; throws if a key is missing. */
function expandPattern(pattern: string, params: Record<string, string>): string {
	return pattern.replace(/\[(.+?)\]/g, (_, key) => {
		if (!(key in params)) {
			throw new Error(
				`[aero] getStaticPaths: missing param "${key}" for pattern "${pattern}". ` +
					`Provided params: ${JSON.stringify(params)}`,
			)
		}
		return params[key]
	})
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

/** Route path to output file path (e.g. '' → index.html, about → about/index.html). */
function toOutputFile(routePath: string): string {
	if (routePath === '') return 'index.html'
	if (routePath === '404') return '404.html'
	return toPosix(path.join(routePath, 'index.html'))
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

/** Relative path from fromDir to targetPath, always starting with ./ when non-empty. */
function normalizeRelativeLink(fromDir: string, targetPath: string): string {
	const rel = path.posix.relative(fromDir, targetPath)
	if (!rel) return './'
	if (rel.startsWith('.')) return rel
	return `./${rel}`
}

/** Relative path to a route (directory index); appends trailing slash for non-root routes. */
function normalizeRelativeRouteLink(fromDir: string, routePath: string): string {
	const targetDir = routePath === '' ? '' : routePath
	const rel = path.posix.relative(fromDir, targetDir)
	let res = !rel ? './' : rel.startsWith('.') ? rel : `./${rel}`

	// If it's a directory link (not empty/root or 404), append slash
	// We assume 'routePath' corresponds to a directory index unless it's 404
	if (routePath !== '' && routePath !== '404' && !res.endsWith('/')) {
		res += '/'
	}
	return res
}

function normalizeRoutePathFromHref(value: string): string {
	if (value === '/') return ''
	return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

/** True if URL is empty or matches SKIP_PROTOCOL_REGEX (external, hash, etc.). */
function isSkippableUrl(value: string): boolean {
	if (!value) return true
	return SKIP_PROTOCOL_REGEX.test(value)
}

/** Root-relative path for manifest key (posix). */
function toManifestKey(root: string, filePath: string): string {
	return toPosixRelative(filePath, root)
}

/** Resolve script/link src or href to absolute path; returns null for external/skippable or unresolvable. */
function resolveTemplateAssetPath(
	rawValue: string,
	templateFile: string,
	root: string,
	resolvePath?: (specifier: string) => string,
): string | null {
	if (!rawValue || isSkippableUrl(rawValue)) return null
	if (rawValue.startsWith('/')) return path.resolve(root, rawValue.slice(1))
	if (rawValue.startsWith('@') || rawValue.startsWith('~')) {
		const resolved = resolvePath ? resolvePath(rawValue) : rawValue
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
	const allPageNames = new Set(
		pageFiles.map(f => pagePathToKey(toPosixRelative(f, root))),
	)

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
	templateRoot: string,
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
	templateRoot: string,
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
	resolvePath?: (specifier: string) => string,
	templateRoot = 'client',
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

/** Prepend `<!doctype html>` if missing. */
export function addDoctype(html: string): string {
	return /^\s*<!doctype\s+html/i.test(html) ? html : `<!doctype html>\n${html}`
}

/** Image extensions: when a manifest entry's .file is a .js chunk but .assets lists the real image, use it. */
const ASSET_IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i

/** Rewrite one absolute URL to dist-relative using manifest and route set; leaves API and external URLs unchanged. */
function rewriteAbsoluteUrl(
	value: string,
	fromDir: string,
	manifest: Manifest,
	routeSet: Set<string>,
	apiPrefix = DEFAULT_API_PREFIX,
): string {
	if (value.startsWith(apiPrefix)) return value

	const noQuery = value.split(/[?#]/)[0] || value
	const suffix = value.slice(noQuery.length)
	const manifestKey = noQuery.replace(/^\//, '')
	// Vite manifest may key entries with or without leading slash
	let manifestEntry = manifest[noQuery] ?? manifest[manifestKey]

	// Entry may be keyed by source path; URL in HTML may be the output path (e.g. /assets/about.jpg-xxx.js from SSR import)
	if (!manifestEntry && noQuery.startsWith('assets/')) {
		const entry = Object.values(manifest).find(
			(e: any) => e?.file === noQuery || e?.file === manifestKey,
		)
		if (entry) manifestEntry = entry as typeof manifestEntry
	}

	if (manifestEntry?.file) {
		// Prefer the actual image asset when the entry's .file is a .js chunk (image import wrapper)
		const entryWithAssets = manifestEntry as { file: string; assets?: string[] }
		const imageAsset =
			entryWithAssets.assets?.find((a: string) => ASSET_IMAGE_EXT.test(a))
		const fileToUse = imageAsset ?? manifestEntry.file
		const rel = normalizeRelativeLink(fromDir, fileToUse)
		return rel + suffix
	}

	if (noQuery.startsWith('/assets/')) {
		const rel = normalizeRelativeLink(fromDir, noQuery.replace(/^\//, ''))
		return rel + suffix
	}

	const route = normalizeRoutePathFromHref(noQuery)
	if (routeSet.has(route) || route === '') {
		const rel =
			route === '404'
				? normalizeRelativeLink(fromDir, toOutputFile(route))
				: normalizeRelativeRouteLink(fromDir, route)
		return rel + suffix
	}

	// Treat remaining absolute URLs as dist-root files (e.g. /favicon.svg).
	const rel = normalizeRelativeLink(fromDir, noQuery.replace(/^\//, ''))
	return rel + suffix
}

/** Rewrite script src (virtual client → hashed asset) and LINK_ATTRS in rendered HTML; add doctype. */
function rewriteRenderedHtml(
	html: string,
	outputFile: string,
	manifest: Manifest,
	routeSet: Set<string>,
	apiPrefix = DEFAULT_API_PREFIX,
): string {
	const fromDir = path.posix.dirname(outputFile)
	const { document } = parseHTML(html)

	// Rewrite virtual client script src to hashed asset path (they are bundled as Rollup entries)
	for (const script of Array.from(document.querySelectorAll('script[src]'))) {
		const src = script.getAttribute('src') || ''
		if (src.startsWith(CLIENT_SCRIPT_PREFIX)) {
			const newSrc = rewriteAbsoluteUrl(src, fromDir, manifest, routeSet, apiPrefix)
			script.setAttribute('src', newSrc)
			script.setAttribute('type', 'module')
			script.removeAttribute('defer') // redundant with type=module
			continue
		}
		// Asset pipeline scripts: strip redundant defer when type=module (modules are deferred by default)
		if (script.getAttribute('type') === 'module') {
			script.removeAttribute('defer')
		}
	}

	for (const el of Array.from(document.querySelectorAll('*'))) {
		for (const attrName of LINK_ATTRS) {
			if (!el.hasAttribute(attrName)) continue
			const current = (el.getAttribute(attrName) || '').trim()
			if (!current || isSkippableUrl(current)) continue
			if (!current.startsWith('/')) continue
			el.setAttribute(
				attrName,
				rewriteAbsoluteUrl(current, fromDir, manifest, routeSet, apiPrefix),
			)
		}
	}

	const htmlTag = document.documentElement
	if (htmlTag) return addDoctype(htmlTag.outerHTML)
	return addDoctype(document.toString())
}

function readManifest(distDir: string): Manifest {
	const manifestPath = path.join(distDir, '.vite', 'manifest.json')
	if (!fs.existsSync(manifestPath)) return {}
	return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest
}

/**
 * Render all static pages into outDir: discover pages, expand dynamic routes via getStaticPaths, run Vite in middleware mode, rewrite URLs, optionally minify.
 *
 * @param options - StaticBuildOptions (root, dirs, resolvePath, vitePlugins, minify).
 * @param outDir - Output directory (e.g. dist).
 */
export async function renderStaticPages(
	options: StaticBuildOptions,
	outDir: string,
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
	const previousAeroNitro = process.env.AERO_NITRO
	process.env.AERO_NITRO = 'false'

	// Use a dedicated cache dir so the static server does not reuse the main build's
	// transform cache (which would hand compiled .html→JS to import-analysis and fail).
	const staticCacheDir = path.join(root, '.aero', 'vite-ssr')
	const server = await createServer({
		configFile: false,
		root,
		cacheDir: staticCacheDir,
		appType: 'custom',
		logLevel: 'error',
		plugins: options.vitePlugins ?? [],
		server: {
			middlewareMode: true,
			hmr: false,
			watch: { ignored: ['**/*'] },
		},
	})

	try {
		const runtime = await server.ssrLoadModule(RUNTIME_INSTANCE_MODULE_ID)

		// Expand dynamic pages via getStaticPaths before rendering.
		const pages: StaticPage[] = []
		for (const page of discoveredPages) {
			if (!isDynamicPage(page)) {
				pages.push(page)
				continue
			}

			// Load the compiled module to check for getStaticPaths export
			const mod = await server.ssrLoadModule(page.sourceFile)
			if (typeof mod.getStaticPaths !== 'function') {
				console.warn(
					`[aero] ⚠ Skipping dynamic page "${path.relative(root, page.sourceFile)}" — ` +
						`no getStaticPaths() exported. Page will not be pre-rendered.`,
				)
				continue
			}

			const staticPaths: StaticPathEntry[] = await mod.getStaticPaths()
			if (!Array.isArray(staticPaths) || staticPaths.length === 0) {
				console.warn(
					`[aero] ⚠ getStaticPaths() for "${path.relative(root, page.sourceFile)}" ` +
						`returned no paths. Page will not be pre-rendered.`,
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
			(options.redirects ?? []).map(r =>
				r.from.replace(/^\/+|\/+$/g, '').trim() || '',
			),
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
				? toPosixRelative(page.sourceFile, path.resolve(root, dirs.client, 'pages')).replace(/\.html$/i, '')
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
				apiPrefix,
			)

			// Minify HTML in production
			const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD
			if (options.minify && isProd) {
				rendered = await minifyHTML(rendered, {
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
		if (previousAeroNitro === undefined) {
			delete process.env.AERO_NITRO
		} else {
			process.env.AERO_NITRO = previousAeroNitro
		}
	}
}

interface BuildConfigOptions {
	dirs?: AeroDirs
	resolvePath?: (specifier: string) => string
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
	root = process.cwd(),
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
