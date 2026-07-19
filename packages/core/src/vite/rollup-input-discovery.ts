/**
 * Rollup input discovery: TemplateDiscovery cache, client scripts, template assets, createBuildConfig.
 */

import type { AeroDirs, ParseResult, ScriptEntry } from '../types'
import type { UserConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { parseHTML } from 'linkedom'
import { parse } from '@aero-js/compiler'
import { toPosixRelative } from '../utils/path'
import { getClientScriptVirtualUrl, resolveDirs, SKIP_PROTOCOL_REGEX } from './defaults'
import { isIncrementalStaticBuildEnabled } from './build-manifest'
import { discoverReactivePagePaths } from './runtime-template-discovery'
import { walkFiles, walkHtmlFiles } from '../utils/fs-walk'

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

/**
 * Walks template paths once and caches file contents so client-script and asset discovery
 * share one `discoverTemplates` + read pass when used from the same build (e.g. `createBuildConfig`
 * and dev `buildStart` for the client-script map — Phase B single discovery pass).
 */
export class TemplateDiscovery {
	private readonly root: string
	private readonly templateRoot: string
	private _files: string[] | null = null
	private readonly sourceByFile = new Map<string, string>()

	constructor(root: string, templateRoot: string) {
		this.root = root
		this.templateRoot = templateRoot
	}

	get templateFiles(): string[] {
		if (!this._files) this._files = discoverTemplates(this.root, this.templateRoot)
		return this._files
	}

	readSource(file: string): string {
		let s = this.sourceByFile.get(file)
		if (!s) {
			s = fs.readFileSync(file, 'utf-8')
			this.sourceByFile.set(file, s)
		}
		return s
	}
}

/** One pass over `TemplateDiscovery`: client virtual scripts + template-referenced assets (shared parse/read). */
interface TemplateDerivedRollupData {
	clientScriptContentMap: Map<string, ScriptEntry>
	virtualClientInputs: Record<string, string>
	templateAssetEntries: Map<string, string>
}

function collectTemplateDerivedRollupData(
	root: string,
	templateRoot: string,
	resolvePath: ((specifier: string, importer: string) => string) | undefined,
	discovery: TemplateDiscovery
): TemplateDerivedRollupData {
	const clientScriptContentMap = new Map<string, ScriptEntry>()
	const virtualClientInputs: Record<string, string> = {}
	const templateAssetEntries = new Map<string, string>()

	for (const templateFile of discovery.templateFiles) {
		const source = discovery.readSource(templateFile)
		const rel = toPosixRelative(templateFile, root)
		const baseName = rel.replace(/\.html$/i, '')

		const parsed = parse(source)
		if (parsed.clientScripts.length > 0) {
			registerClientScriptsToMap(parsed, baseName, clientScriptContentMap)
			const { clientScripts } = parsed
			const total = clientScripts.length
			for (let i = 0; i < total; i++) {
				const virtualPath = getClientScriptVirtualUrl(baseName, i, total)
				const manifestKey = virtualPath.replace(/^\//, '')
				virtualClientInputs[manifestKey] = virtualPath
			}
		}

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
			templateAssetEntries.set(toManifestKey(root, resolved), resolved)
		}
	}

	return { clientScriptContentMap, virtualClientInputs, templateAssetEntries }
}

/** Default `client/index.ts` and `client/assets/images` entries merged into template-derived assets. */
function appendDefaultAndImageAssetInputs(
	root: string,
	templateRoot: string,
	entries: Map<string, string>
): void {
	const defaultClientEntry = path.resolve(root, `${templateRoot}/index.ts`)
	if (fs.existsSync(defaultClientEntry)) {
		entries.set(toManifestKey(root, defaultClientEntry), defaultClientEntry)
	}

	const imagesDir = path.resolve(root, templateRoot, 'assets/images')
	if (fs.existsSync(imagesDir)) {
		const imageFiles = walkFiles(imagesDir)
		for (const file of imageFiles) {
			const key = toManifestKey(root, file)
			if (entries.has(key)) continue
			if (path.basename(file).startsWith('.')) continue
			entries.set(key, file)
		}
	}
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
	sharedDiscovery?: TemplateDiscovery
): Map<string, ScriptEntry> {
	const discovery = sharedDiscovery ?? new TemplateDiscovery(root, templateRoot)
	return collectTemplateDerivedRollupData(root, templateRoot, undefined, discovery)
		.clientScriptContentMap
}

interface BuildConfigOptions {
	dirs?: AeroDirs
	resolvePath?: (specifier: string, importer: string) => string
	reactivity?: boolean
}

/**
 * Vite build config: outDir, manifest, emptyOutDir, rollupOptions.input from discovered assets and virtual client scripts.
 *
 * @param options - Optional dirs and resolvePath for asset discovery.
 * @param root - Project root (default process.cwd()).
 * @param sharedDiscovery - Optional shared {@link TemplateDiscovery} (dev: same instance as `buildStart` client-script map).
 * @returns Vite UserConfig.build fragment.
 */
export function createBuildConfig(
	options: BuildConfigOptions = {},
	root = process.cwd(),
	sharedDiscovery?: TemplateDiscovery
): UserConfig['build'] {
	const dirs = resolveDirs(options.dirs)
	const templateDiscovery = sharedDiscovery ?? new TemplateDiscovery(root, dirs.client)
	const { virtualClientInputs, templateAssetEntries } = collectTemplateDerivedRollupData(
		root,
		dirs.client,
		options.resolvePath,
		templateDiscovery
	)
	const assetEntries = new Map(templateAssetEntries)
	appendDefaultAndImageAssetInputs(root, dirs.client, assetEntries)
	if (options.reactivity) {
		for (const pagePath of discoverReactivePagePaths(root, dirs.client)) {
			assetEntries.set(toManifestKey(root, pagePath), pagePath)
		}
	}
	const inputs = { ...Object.fromEntries(assetEntries), ...virtualClientInputs }
	return {
		outDir: dirs.dist,
		manifest: true,
		emptyOutDir: !isIncrementalStaticBuildEnabled(),
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
