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
} from './loader'
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
		/** Load content.config.ts, set contentConfig and watchedDirs; warn if config missing. */
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
			} catch (err: any) {
				if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ENOENT') {
					config.logger.warn(
						`[aero:content] No config found at "${configPath}". Content collections disabled.`,
					)
					return
				}
				throw err
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

		/** Load virtual module: loadAllCollections, serializeContentModule, return ESM source. */
		async load(id) {
			if (id !== RESOLVED_CONTENT_MODULE_ID) return null
			if (!contentConfig) {
				return '// aero:content — no collections configured\n'
			}

			// Load and serialize all collections
			const loaded = await loadAllCollections(contentConfig, resolvedConfig.root)
			serialized = serializeContentModule(loaded)
			return serialized
		},

		/** Invalidate virtual module and full-reload when a file in a watched content dir changes. */
		handleHotUpdate({ file, server }) {
			const isContent = watchedDirs.some(dir => file.startsWith(dir))
			if (!isContent) return

			// Invalidate the virtual module so it reloads
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
			} catch {
				// Silent — warning already issued in configResolved
			}
		},
	}
}
