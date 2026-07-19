/**
 * Virtual-modules plugin: HMR (handleHotUpdate) and FS watchers (configureServer).
 */

import type { Plugin, ViteDevServer } from 'vite'
import { parse } from '@aero-js/compiler'
import { toPosixRelative } from '../utils/path'
import path from 'path'
import {
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	toAeroStyleInlineImportId,
	toAeroStyleVirtualModuleId,
} from './defaults'
import { syncClientScriptsForTemplate } from './client-script-sync'
import { writeRouteManifestGenerated } from '../routing/route-manifest'
import { writeRouteTypesGenerated } from '../routing/route-typegen'
import { writeSnippetTypesGenerated } from '../snippet-typegen'
import { isAeroTemplateHtml } from './is-aero-template-html'
import { collectSnippetHotUpdateModules } from './snippet-hmr'
import type { AeroPluginState } from './plugin-state'
import { extractTopLevelStyleBodies } from './template-style-bodies'

type HandleHotUpdateFn = NonNullable<Plugin['handleHotUpdate']>
type ConfigureServerFn = NonNullable<Plugin['configureServer']>

function invalidateId(
	server: ViteDevServer,
	id: string,
	invalidated: Set<unknown>
): void {
	const mod = server.moduleGraph.getModuleById(id)
	if (!mod || invalidated.has(mod)) return
	server.moduleGraph.invalidateModule(mod)
	invalidated.add(mod)
}

export function createAeroVirtualsHandleHotUpdate(state: AeroPluginState): HandleHotUpdateFn {
	return async function handleHotUpdate(ctx) {
		if (!state.config || state.config.command === 'build') return

		const snippetModules = collectSnippetHotUpdateModules(ctx.file, ctx.server)
		if (snippetModules.length > 0) return snippetModules

		if (!ctx.file.endsWith('.html')) return
		if (!isAeroTemplateHtml(ctx.file, state.config.root, state.dirs)) return

		const code = await ctx.read()
		const parsed = parse(code)
		const styleCount = extractTopLevelStyleBodies(code).length
		const invalidated = new Set<unknown>()
		// +2 covers a style block removed on this edit still cached in the graph
		for (let i = 0; i < styleCount + 2; i++) {
			invalidateId(ctx.server, toAeroStyleVirtualModuleId(ctx.file, i), invalidated)
			invalidateId(ctx.server, toAeroStyleInlineImportId(ctx.file, i), invalidated)
		}

		const relativePath = toPosixRelative(ctx.file, state.config.root)
		const baseName = relativePath.replace(/\.html$/i, '')
		const { changed, affectedIds } = syncClientScriptsForTemplate(
			parsed,
			baseName,
			state.clientScripts
		)
		if (!changed || affectedIds.length === 0) {
			// Style/markup-only: CSS virtuals invalidated above; Vite continues with SSR refresh.
			return
		}

		for (const virtualId of affectedIds) {
			invalidateId(ctx.server, '\0' + virtualId, invalidated)
			invalidateId(ctx.server, virtualId, invalidated)
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
