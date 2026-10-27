/**
 * Tailwind `@import`ed CSS is registered via `addWatchFile`, so Vite only sees
 * non-self-accepting asset modules. `@tailwindcss/vite` then full-reloads the page.
 * Remap those assets to self-accepting parent CSS modules so styles HMR instead.
 */

import type { ModuleNode, Plugin } from 'vite'

function isAssetOnlyCssHotUpdate(modules: ModuleNode[]): boolean {
	return modules.length > 0 && modules.every(mod => mod.type === 'asset' || mod.id == null)
}

function selfAcceptingCssModules(modules: ModuleNode[]): ModuleNode[] {
	return modules.filter(mod => mod.type === 'css' && mod.isSelfAccepting)
}

function hasOrphanTailwindCssAssets(modules: ModuleNode[]): boolean {
	return modules.some(mod => mod.type === 'asset' || (mod.id == null && mod.type !== 'css'))
}

/** Walk importers from asset CSS deps to find self-accepting CSS HMR boundaries. */
export function collectSelfAcceptingCssImporters(modules: ModuleNode[]): ModuleNode[] {
	const boundaries = new Set<ModuleNode>()
	const seen = new Set<ModuleNode>()
	const queue = [...modules]

	while (queue.length > 0) {
		const mod = queue.shift()!
		if (seen.has(mod)) continue
		seen.add(mod)

		if (mod.type === 'css' && mod.isSelfAccepting) {
			boundaries.add(mod)
			continue
		}

		for (const importer of mod.importers) {
			if (!seen.has(importer)) queue.push(importer)
		}
	}

	return [...boundaries]
}

/**
 * Plugin that converts Tailwind watched CSS `@import` asset updates into CSS HMR.
 */
export function aeroCssImportHmrPlugin(): Plugin {
	return {
		name: 'vite-plugin-aero-css-import-hmr',
		enforce: 'pre',
		hotUpdate(ctx) {
			if (!ctx.file.endsWith('.css')) return
			const modules = ctx.modules as unknown as ModuleNode[]
			if (isAssetOnlyCssHotUpdate(modules)) {
				const boundaries = collectSelfAcceptingCssImporters(modules)
				if (boundaries.length === 0) return
				return boundaries as unknown as typeof ctx.modules
			}

			const cssBoundaries = selfAcceptingCssModules(modules)
			if (cssBoundaries.length > 0 && hasOrphanTailwindCssAssets(modules)) {
				return cssBoundaries as unknown as typeof ctx.modules
			}
		},
	}
}
