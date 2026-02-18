import type { ContentConfig } from './types'
import type { Plugin, ResolvedConfig } from 'vite'
import {
	loadAllCollections,
	serializeContentModule,
	getWatchedDirs,
	toExportName,
} from './loader'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Virtual module prefix for content imports. */
const CONTENT_MODULE_ID = 'aero:content'
const RESOLVED_CONTENT_MODULE_ID = '\0aero:content'

/** Default config file name. */
const CONFIG_FILE = 'aero.content.ts'

export interface AeroContentOptions {
	/** Path to the content config file, relative to project root. Default: `aero.content.ts` */
	config?: string
}

/**
 * Vite plugin that provides the `aero:content` virtual module.
 *
 * ```ts
 * import { aeroContent } from '@aero-ssg/content/vite'
 *
 * export default defineConfig({
 *   plugins: [aero(), aeroContent()],
 * })
 * ```
 */
export function aeroContent(options: AeroContentOptions = {}): Plugin {
	let resolvedConfig: ResolvedConfig
	let contentConfig: ContentConfig | null = null
	let serialized: string | null = null
	let watchedDirs: string[] = []

	return {
		name: 'vite-plugin-aero-content',

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

		resolveId(id) {
			if (id === CONTENT_MODULE_ID) {
				return RESOLVED_CONTENT_MODULE_ID
			}
			// Support per-collection imports: aero:content/docs → resolves to same module
			// (individual collection exports are available from the main module)
			if (id.startsWith(CONTENT_MODULE_ID + '/')) {
				return RESOLVED_CONTENT_MODULE_ID
			}
			return null
		},

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

		handleHotUpdate({ file, server }) {
			// Check if the changed file is inside any watched content directory
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

		// During the build, ensure the config is loaded via Vite's SSR pipeline
		// so that TS config files are correctly transpiled.
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
