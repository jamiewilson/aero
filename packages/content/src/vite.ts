/**
 * Vite plugin for content collections: virtual module `aero:content`, config loading, and HMR invalidation.
 *
 * @remarks
 * Resolves/loads `aero:content` (and `aero:content/...`) with serialized collections and getCollection/render.
 * Loads content.config.ts in configResolved (and buildStart fallback); watches collection dirs and invalidates on change.
 */
import type { ContentConfig } from './types'
import type { Plugin, ResolvedConfig } from 'vite'
import {
	loadAllCollections,
	serializeContentModule,
	getWatchedDirs,
	getContentRoot,
	loadSingleFile,
} from './loader'
import { initProcessor } from './processor'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CONTENT_MODULE_ID = 'aero:content'
const RESOLVED_CONTENT_MODULE_ID = '\0aero:content'
const CONFIG_FILE = 'content.config.ts'

/** Options for the content plugin (config file path). */
export interface AeroContentOptions {
	/** Path to content config file relative to project root (default: `content.config.ts`). */
	config?: string
}

/**
 * Vite plugin that provides the `aero:content` virtual module (getCollection, render, serialized data).
 *
 * @param options - Optional config file path.
 * @returns Vite plugin.
 */
export function aeroContent(options: AeroContentOptions = {}): Plugin {
	let resolvedConfig: ResolvedConfig
	let contentConfig: ContentConfig | null = null
	let serialized: string | null = null
	let watchedDirs: string[] = []

	return {
		name: 'vite-plugin-aero-content',
		/** Load content.config.ts, set contentConfig and watchedDirs; initialize processor early. */
		async configResolved(config) {
			resolvedConfig = config
			const root = config.root
			const configPath = path.resolve(root, options.config || CONFIG_FILE)

			try {
				// Use dynamic import with the file URL to load the config.
				// Vite's SSR pipeline handles TS transpilation during dev.
				const configUrl = pathToFileURL(configPath).href
				const mod = await import(/* @vite-ignore */ configUrl)
				contentConfig = mod.default as ContentConfig
				watchedDirs = getWatchedDirs(contentConfig, root)
				watchedDirs.push(getContentRoot(root))

				// Initialize the markdown processor early with user-supplied plugins.
				// This ensures the processor is configured before any modules are loaded.
				await initProcessor(contentConfig.markdown)
			} catch (err: any) {
				if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ENOENT') {
					config.logger.warn(
						`[aero:content] No config found at "${configPath}". Single-file imports and render() still work with defaults.`
					)
					watchedDirs = [getContentRoot(root)]
				} else {
					throw err
				}
			}
		},

		/** Resolve aero:content and aero:content/… to the resolved virtual ID. */
		resolveId(id) {
			if (id === CONTENT_MODULE_ID) {
				return RESOLVED_CONTENT_MODULE_ID
			}
			if (id.startsWith(CONTENT_MODULE_ID + '/')) {
				return RESOLVED_CONTENT_MODULE_ID
			}
			return null
		},

		/** Load virtual module and .md files under content/. */
		async load(id) {
			// Handle .md files under content/
			const pathPart = id.split('?')[0]
			if (pathPart.endsWith('.md')) {
				const root = resolvedConfig.root
				const contentDir = getContentRoot(root)
				const idPath = id.split('?')[0]
				const absolutePath = path.isAbsolute(idPath)
					? idPath
					: path.resolve(root, idPath)
				const relToContent = path.relative(contentDir, absolutePath)
				if (
					!relToContent.startsWith('..') &&
					!path.isAbsolute(relToContent)
				) {
					try {
						const doc = await loadSingleFile(
							absolutePath,
							contentConfig,
							root
						)
						this.addWatchFile(absolutePath)
						return `export default ${JSON.stringify(doc)}`
					} catch (err) {
						throw err
					}
				}
			}

			if (id !== RESOLVED_CONTENT_MODULE_ID) return null

			// When no config: still export render for single-file use
			if (!contentConfig) {
				return `export { render } from '@aero-js/content/render';
export function getCollection() {
  throw new Error('[aero:content] No content.config.ts found. Add content.config.ts with collections to use getCollection().');
}
`
			}

			// Processor was already initialized in configResolved hook
			// Load and serialize all collections
			const loaded = await loadAllCollections(
				contentConfig,
				resolvedConfig.root
			)
			serialized = serializeContentModule(loaded)
			return serialized
		},

		/** Invalidate virtual module and .md modules when a file in a watched content dir changes. */
		handleHotUpdate({ file, server }) {
			const isContent = watchedDirs.some(dir => file.startsWith(dir))
			if (!isContent) return

			// Invalidate directly imported .md module so it reloads
			const mdMod = server.moduleGraph.getModuleById(file)
			if (mdMod) {
				server.moduleGraph.invalidateModule(mdMod)
			}

			// Invalidate the virtual module so getCollection/render consumers reload
			const mod = server.moduleGraph.getModuleById(RESOLVED_CONTENT_MODULE_ID)
			if (mod) {
				server.moduleGraph.invalidateModule(mod)
				// Trigger a full reload since content data shapes the page
				server.hot.send({ type: 'full-reload' })
			}
		},

		/** Fallback: load config in build if not already loaded in configResolved. */
		async buildStart() {
			if (contentConfig) return // Already loaded in configResolved

			const root = resolvedConfig.root
			const configPath = path.resolve(root, options.config || CONFIG_FILE)

			try {
				// In build mode we need to use Vite's module resolution which
				// handles TypeScript transpilation. However, buildStart doesn't
				// have access to ssrLoadModule, so we rely on the configResolved
				// import having worked. If it didn't (e.g. TS without tsx loader),
				// log a warning.
				const configUrl = pathToFileURL(configPath).href
				const mod = await import(/* @vite-ignore */ configUrl)
				contentConfig = mod.default as ContentConfig
				watchedDirs = getWatchedDirs(contentConfig, root)
				watchedDirs.push(getContentRoot(root))
			} catch {
				// Silent — warning already issued in configResolved; ensure content dir is watched
				watchedDirs = [getContentRoot(root)]
			}
		},
	}
}
