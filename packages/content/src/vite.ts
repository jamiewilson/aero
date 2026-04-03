/**
 * Vite plugin for content collections: virtual module `aero:content`, config loading, and HMR invalidation.
 *
 * @remarks
 * Resolves/loads `aero:content` (and `aero:content/...`) with serialized collections and getCollection/render.
 * Loads content.config.ts in configResolved (and buildStart fallback); watches collection dirs and invalidates on change.
 */
import type { ContentConfig } from './types'
import type { ModuleNode, Plugin, ResolvedConfig } from 'vite'
import { formatContentSchemaIssuesReport } from './content-issues'
import {
	loadAllCollections,
	serializeContentModule,
	getWatchedDirs,
	getContentRoot,
	loadSingleFile,
} from './loader'
import { initProcessor } from './processor'
import { loadContentConfigFileSync } from './load-content-config'
import path from 'node:path'

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
	/** Mutable so tests can seed watched paths; same array configResolved/buildStart assign into. */
	const hotState = { watchedDirs: [] as string[] }
	/** Last virtual-module load: schema warnings count (for build-end recap). */
	let lastContentSchemaIssueCount = 0

	const plugin: Plugin = {
		name: 'vite-plugin-aero-content',
		/** Load content.config.ts, set contentConfig and watchedDirs; initialize processor early. */
		async configResolved(config) {
			resolvedConfig = config
			const root = config.root
			const configFile = options.config || CONFIG_FILE
			const loaded = loadContentConfigFileSync(root, configFile)

			if (!loaded.ok) {
				if (loaded.reason === 'missing') {
					config.logger.warn(
						`[aero:content] No config found at "${configFile}". Single-file imports and render() still work with defaults.`
					)
					hotState.watchedDirs = [getContentRoot(root)]
				} else {
					throw loaded.error
				}
			} else {
				contentConfig = loaded.config
				hotState.watchedDirs = getWatchedDirs(contentConfig, root)
				hotState.watchedDirs.push(getContentRoot(root))
				await initProcessor(contentConfig.markdown)
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
				const absolutePath = path.isAbsolute(idPath) ? idPath : path.resolve(root, idPath)
				const relToContent = path.relative(contentDir, absolutePath)
				if (!relToContent.startsWith('..') && !path.isAbsolute(relToContent)) {
					try {
						const doc = await loadSingleFile(absolutePath, contentConfig, root)
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
export const __aeroContentSchemaIssues = [];
export function getCollection() {
  throw new Error('[aero:content] No content.config.ts found. Add content.config.ts with collections to use getCollection().');
}
`
			}

			// Processor was already initialized in configResolved hook
			// Load and serialize all collections
			const { loaded, schemaIssues } = await loadAllCollections(contentConfig, resolvedConfig.root, {
				contentConfigPath: options.config || CONFIG_FILE,
			})
			if (schemaIssues.length > 0) {
				resolvedConfig.logger.warn(formatContentSchemaIssuesReport(schemaIssues))
			}
			lastContentSchemaIssueCount = schemaIssues.length
			serialized = serializeContentModule(loaded, { schemaIssues })
			return serialized
		},

		/** One-line recap when the virtual module reported schema warnings (skipped files). */
		closeBundle() {
			if (lastContentSchemaIssueCount > 0 && resolvedConfig) {
				resolvedConfig.logger.info(
					`[aero:content] Build finished with ${lastContentSchemaIssueCount} schema warning(s) (skipped files; details were logged during load).`
				)
			}
		},

		/**
		 * Invalidate virtual module and .md modules when a file in a watched content dir changes.
		 * Returns affected module nodes so Vite propagates HMR to `aero:content` importers without a full page reload.
		 */
		handleHotUpdate({ file, server }): ModuleNode[] | void {
			const isContent = hotState.watchedDirs.some(dir => file.startsWith(dir))
			if (!isContent) return

			const mods: ModuleNode[] = []

			const mdMod = server.moduleGraph.getModuleById(file)
			if (mdMod) {
				server.moduleGraph.invalidateModule(mdMod)
				mods.push(mdMod)
			}

			const mod = server.moduleGraph.getModuleById(RESOLVED_CONTENT_MODULE_ID)
			if (mod) {
				server.moduleGraph.invalidateModule(mod)
				mods.push(mod)
			}

			return mods.length > 0 ? mods : undefined
		},

		/** Fallback: load config in build if not already loaded in configResolved. */
		async buildStart() {
			if (contentConfig) return // Already loaded in configResolved

			const root = resolvedConfig.root
			const configFile = options.config || CONFIG_FILE
			const loaded = loadContentConfigFileSync(root, configFile)
			if (!loaded.ok) {
				hotState.watchedDirs = [getContentRoot(root)]
				return
			}
			contentConfig = loaded.config
			hotState.watchedDirs = getWatchedDirs(contentConfig, root)
			hotState.watchedDirs.push(getContentRoot(root))
			await initProcessor(contentConfig.markdown)
		},
	}

	Object.defineProperty(plugin, '__hotState', {
		value: hotState,
		enumerable: false,
	})

	return plugin
}
