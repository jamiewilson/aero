/**
 * Virtual-modules plugin: HMR (handleHotUpdate) and FS watchers (configureServer).
 */

import type { Plugin, ViteDevServer } from 'vite'
import { parse } from '@aero-js/compiler'
import { toPosixRelative } from '../utils/path'
import path from 'path'
import { RESOLVED_RUNTIME_INSTANCE_MODULE_ID } from './defaults'
import { syncClientScriptsForTemplate } from './client-script-sync'
import { writeRouteManifestGenerated } from '../routing/route-manifest'
import { writeRouteTypesGenerated } from '../routing/route-typegen'
import { writeSnippetTypesGenerated } from '../snippet-typegen'
import { isAeroTemplateHtml } from './is-aero-template-html'
import { collectSnippetHotUpdateModules } from './snippet-hmr'
import type { AeroPluginState } from './plugin-state'

type HandleHotUpdateFn = NonNullable<Plugin['handleHotUpdate']>
type ConfigureServerFn = NonNullable<Plugin['configureServer']>

export function createAeroVirtualsHandleHotUpdate(state: AeroPluginState): HandleHotUpdateFn {
	return async function handleHotUpdate(ctx) {
		if (!state.config || state.config.command === 'build') return

		const snippetModules = collectSnippetHotUpdateModules(ctx.file, ctx.server)
		if (snippetModules.length > 0) return snippetModules

		if (!ctx.file.endsWith('.html')) return
		if (!isAeroTemplateHtml(ctx.file, state.config.root, state.dirs)) return

		const code = await ctx.read()
		const parsed = parse(code)

		const relativePath = toPosixRelative(ctx.file, state.config.root)
		const baseName = relativePath.replace(/\.html$/i, '')
		const { changed, affectedIds } = syncClientScriptsForTemplate(
			parsed,
			baseName,
			state.clientScripts
		)
		if (!changed || affectedIds.length === 0) return

		const invalidated = new Set<any>()
		for (const virtualId of affectedIds) {
			const moduleId = '\0' + virtualId
			const mod =
				ctx.server.moduleGraph.getModuleById(moduleId) ||
				ctx.server.moduleGraph.getModuleById(virtualId)
			if (!mod || invalidated.has(mod)) continue
			ctx.server.moduleGraph.invalidateModule(mod)
			invalidated.add(mod)
		}

		// Module scripts executed via injected <script type="module" src="..."> need a full reload
		// so browser module caching does not keep stale script behavior.
		ctx.server.ws.send({ type: 'full-reload' })
		return []
	}
}

export function createAeroVirtualsConfigureServer(state: AeroPluginState): ConfigureServerFn {
	return function configureServer(server: ViteDevServer) {
		const invalidateRuntimeRegistration = (): void => {
			const mod = server.moduleGraph.getModuleById(RESOLVED_RUNTIME_INSTANCE_MODULE_ID)
			if (mod) server.moduleGraph.invalidateModule(mod)
		}
		const regenerateRouteArtifacts = (): void => {
			if (!state.config) return
			const { manifest } = writeRouteManifestGenerated(state.config.root, state.dirs.client)
			writeRouteTypesGenerated(state.config.root, manifest)
		}
		const regenerateSnippetTypes = (): void => {
			if (!state.config) return
			writeSnippetTypesGenerated(state.config.root)
		}
		const onClientTemplateFs = (file: string): void => {
			if (!file.endsWith('.html')) return
			if (!state.config) return
			const clientRoot = path.resolve(state.config.root, state.dirs.client)
			const abs = path.resolve(file)
			if (abs !== clientRoot && !abs.startsWith(clientRoot + path.sep)) return
			regenerateRouteArtifacts()
			invalidateRuntimeRegistration()
		}
		server.watcher.on('add', onClientTemplateFs)
		server.watcher.on('unlink', onClientTemplateFs)
		const onSnippetFs = (file: string): void => {
			if (!state.config) return
			const snippetsRoot = path.resolve(state.config.root, 'content', 'snippets')
			const abs = path.resolve(file)
			if (abs !== snippetsRoot && !abs.startsWith(snippetsRoot + path.sep)) return
			regenerateSnippetTypes()
		}
		server.watcher.on('add', onSnippetFs)
		server.watcher.on('change', onSnippetFs)
		server.watcher.on('unlink', onSnippetFs)
	}
}
