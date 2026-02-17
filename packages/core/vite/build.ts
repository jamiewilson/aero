import type { AeroDirs, StaticPathEntry } from '../types'
import type { Manifest, Plugin, UserConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { parseHTML } from 'linkedom'
import { parse } from '../compiler/parser'
import { createServer } from 'vite'
import {
	CLIENT_SCRIPT_PREFIX,
	DEFAULT_API_PREFIX,
	LINK_ATTRS,
	RUNTIME_INSTANCE_MODULE_ID,
	SKIP_PROTOCOL_REGEX,
	resolveDirs,
} from './defaults'

interface StaticBuildOptions {
	root: string
	dirs?: AeroDirs
	apiPrefix?: string
	resolvePath?: (specifier: string) => string
	vitePlugins?: Plugin[]
}

interface StaticPage {
	pageName: string
	routePath: string
	sourceFile: string
	outputFile: string
	params?: Record<string, string>
}

/** The pageName or routePath contains bracket-delimited dynamic segments. */
function isDynamicPage(page: StaticPage): boolean {
	return /\[.+?\]/.test(page.pageName)
}

/**
 * Replace bracket segments in a pattern with concrete param values.
 * e.g. expandPattern('[id]', { id: 'alpha' }) → 'alpha'
 *      expandPattern('docs/[slug]', { slug: 'intro' }) → 'docs/intro'
 */
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

function toPosix(value: string): string {
	return value.replace(/\\/g, '/')
}

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

function toRouteFromPageName(pageName: string): string {
	if (pageName === 'index') return ''
	if (pageName.endsWith('/index')) return pageName.slice(0, -'/index'.length)
	return pageName
}

function toOutputFile(routePath: string): string {
	if (routePath === '') return 'index.html'
	if (routePath === '404') return '404.html'
	return toPosix(path.join(routePath, 'index.html'))
}

function normalizeRelativeLink(fromDir: string, targetPath: string): string {
	const rel = path.posix.relative(fromDir, targetPath)
	if (!rel) return './'
	if (rel.startsWith('.')) return rel
	return `./${rel}`
}

function normalizeRelativeRouteLink(fromDir: string, routePath: string): string {
	const targetDir = routePath === '' ? '' : routePath
	const rel = path.posix.relative(fromDir, targetDir)
	if (!rel) return './'
	return rel.startsWith('.') ? rel : `./${rel}`
}

function normalizeRoutePathFromHref(value: string): string {
	if (value === '/') return ''
	return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

function isSkippableUrl(value: string): boolean {
	if (!value) return true
	return SKIP_PROTOCOL_REGEX.test(value)
}

function toManifestKey(root: string, filePath: string): string {
	return toPosix(path.relative(root, filePath))
}

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

function discoverTemplates(root: string, templateRoot: string): string[] {
	return walkHtmlFiles(path.resolve(root, templateRoot))
}

function discoverPages(root: string, pagesRoot: string): StaticPage[] {
	const pagesDir = path.resolve(root, pagesRoot)
	const pageFiles = walkHtmlFiles(pagesDir)

	// Build a set of all page names so we can detect when home.html should
	// act as the root index (i.e. when no sibling index.html exists).
	const allPageNames = new Set(
		pageFiles.map(f => toPosix(path.relative(pagesDir, f)).replace(/\.html$/i, '')),
	)

	return pageFiles.map(file => {
		const rel = toPosix(path.relative(pagesDir, file))
		let pageName = rel.replace(/\.html$/i, '')

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

function discoverClientScriptMap(root: string, templateRoot: string): Map<string, string> {
	const map = new Map<string, string>()
	for (const file of discoverTemplates(root, templateRoot)) {
		const source = fs.readFileSync(file, 'utf-8')
		const parsed = parse(source)
		if (!parsed.clientScript) continue
		const rel = toPosix(path.relative(root, file))
		const virtualPath = `${CLIENT_SCRIPT_PREFIX}${rel.replace(/\.html$/i, '.js')}`
		map.set(virtualPath, parsed.clientScript.content)
	}
	return map
}

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

	return Object.fromEntries(entries)
}

function addDoctype(html: string): string {
	return /^\s*<!doctype\s+html/i.test(html) ? html : `<!doctype html>\n${html}`
}

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
	const manifestEntry = manifest[manifestKey]

	if (manifestEntry?.file) {
		const rel = normalizeRelativeLink(fromDir, manifestEntry.file)
		return rel + suffix
	}

	if (noQuery.startsWith('/assets/')) {
		const rel = normalizeRelativeLink(fromDir, noQuery.replace(/^\//, ''))
		return rel + suffix
	}

	const route = normalizeRoutePathFromHref(noQuery)
	if (routeSet.has(route) || route === '') {
		const rel =
			route === '404' ?
				normalizeRelativeLink(fromDir, toOutputFile(route))
			:	normalizeRelativeRouteLink(fromDir, route)
		return rel + suffix
	}

	// Treat remaining absolute URLs as dist-root files (e.g. /favicon.svg).
	const rel = normalizeRelativeLink(fromDir, noQuery.replace(/^\//, ''))
	return rel + suffix
}

function rewriteRenderedHtml(
	html: string,
	outputFile: string,
	manifest: Manifest,
	routeSet: Set<string>,
	clientScriptMap: Map<string, string>,
	apiPrefix = DEFAULT_API_PREFIX,
): string {
	const fromDir = path.posix.dirname(outputFile)
	const { document } = parseHTML(html)

	for (const script of Array.from(document.querySelectorAll('script[src]'))) {
		const src = script.getAttribute('src') || ''
		if (src.startsWith(CLIENT_SCRIPT_PREFIX)) {
			const scriptContent = clientScriptMap.get(src)
			if (!scriptContent) continue
			script.removeAttribute('src')
			script.setAttribute('type', 'module')
			script.textContent = scriptContent
			continue
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
	const clientScriptMap = discoverClientScriptMap(root, dirs.client)

	const server = await createServer({
		configFile: false,
		root,
		appType: 'custom',
		logLevel: 'error',
		plugins: options.vitePlugins,
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
				})
			}
		}

		const routeSet = new Set(pages.map(p => p.routePath))

		for (const page of pages) {
			const routePath = page.routePath ? `/${page.routePath}` : '/'
			const pageUrl = new URL(routePath, 'http://localhost')

			// For expanded dynamic pages we must render via the original
			// dynamic page name (e.g. "[id]") so the runtime finds the module,
			// while passing the concrete params so the template has real values.
			const renderTarget =
				isDynamicPage(page) ?
					toPosix(
						path
							.relative(path.resolve(root, dirs.client, 'pages'), page.sourceFile)
							.replace(/\.html$/i, ''),
					)
				:	page.pageName

			let rendered = await runtime.aero.render(renderTarget, {
				url: pageUrl,
				request: new Request(pageUrl.toString(), { method: 'GET' }),
				routePath,
				params: page.params || {},
			})
			rendered = rewriteRenderedHtml(
				addDoctype(rendered),
				page.outputFile,
				manifest,
				routeSet,
				clientScriptMap,
				apiPrefix,
			)

			const outPath = path.join(distDir, page.outputFile)
			fs.mkdirSync(path.dirname(outPath), { recursive: true })
			fs.writeFileSync(outPath, rendered, 'utf-8')
		}
	} finally {
		await server.close()
	}
}

interface BuildConfigOptions {
	dirs?: AeroDirs
	resolvePath?: (specifier: string) => string
}

export function createBuildConfig(
	options: BuildConfigOptions = {},
	root = process.cwd(),
): UserConfig['build'] {
	const dirs = resolveDirs(options.dirs)
	const inputs = discoverAssetInputs(root, options.resolvePath, dirs.client)
	return {
		outDir: dirs.dist,
		manifest: true,
		emptyOutDir: true,
		rollupOptions: {
			input: inputs,
			output: {
				entryFileNames(chunkInfo) {
					const baseName =
						chunkInfo.facadeModuleId ? path.basename(chunkInfo.facadeModuleId) : chunkInfo.name
					return `assets/scripts/${baseName}-[hash].js`
				},
				chunkFileNames: 'assets/scripts/[name]-[hash].js',
				assetFileNames(assetInfo) {
					const ext = path.extname(assetInfo.name || '').toLowerCase()
					if (ext === '.css') return 'assets/styles/[name]-[hash][extname]'
					return 'assets/[name]-[hash][extname]'
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
}
