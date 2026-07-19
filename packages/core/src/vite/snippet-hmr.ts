/**
 * Propagate snippet file changes through Vite module graphs (dev HMR + fresh SSR).
 */

import type { ModuleNode, ViteDevServer } from 'vite'
import path from 'path'
import {
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	toSnippetVirtualModuleId,
} from './defaults'
import { isSnippetModulePath } from '../snippets'

interface SnippetGraphModule {
	importers: Set<SnippetGraphModule>
}

interface ModuleGraphLike {
	getModuleById(id: string): SnippetGraphModule | undefined
	invalidateModule(mod: SnippetGraphModule, seen?: Set<SnippetGraphModule>): void
}

/** Invalidate snippet virtual module, its importers, and runtime instance in one module graph. */
export function invalidateSnippetModulesInGraph(
	moduleGraph: ModuleGraphLike,
	snippetFile: string,
	affected: Set<SnippetGraphModule>
): void {
	const virtualId = toSnippetVirtualModuleId(path.resolve(snippetFile))
	const snippetMod = moduleGraph.getModuleById(virtualId)
	if (!snippetMod) return

	const queue: SnippetGraphModule[] = [snippetMod]
	const seen = new Set<SnippetGraphModule>()
	while (queue.length > 0) {
		const mod = queue.shift()!
		if (seen.has(mod)) continue
		seen.add(mod)
		moduleGraph.invalidateModule(mod)
		affected.add(mod)
		for (const importer of mod.importers) {
			if (!seen.has(importer)) queue.push(importer)
		}
	}

	const runtimeMod = moduleGraph.getModuleById(RESOLVED_RUNTIME_INSTANCE_MODULE_ID)
	if (runtimeMod && !seen.has(runtimeMod)) {
		moduleGraph.invalidateModule(runtimeMod)
		affected.add(runtimeMod)
	}
}

/**
 * Propagate snippet file changes through client and SSR module graphs so importing pages
 * and the runtime instance re-execute (dev HMR + fresh SSR).
 */
export function collectSnippetHotUpdateModules(file: string, server: ViteDevServer): ModuleNode[] {
	if (!isSnippetModulePath(file)) return []
	const affected = new Set<SnippetGraphModule>()
	invalidateSnippetModulesInGraph(server.moduleGraph, file, affected)
	const ssrGraph = server.environments.ssr?.moduleGraph
	if (ssrGraph) invalidateSnippetModulesInGraph(ssrGraph, file, affected)
	return [...affected] as ModuleNode[]
}
