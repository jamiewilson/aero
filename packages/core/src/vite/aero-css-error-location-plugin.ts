/**
 * Wrap `@tailwindcss/vite` generate transforms so CssSyntaxError keeps the original CSS path.
 */

import type { HookHandler, Plugin } from 'vite'
import path from 'node:path'
import { enrichCssSyntaxError } from './css-syntax-error-probe'
import { collectClientStyleCssFiles } from './collect-client-style-css'

const TAILWIND_GENERATE = new Set([
	'@tailwindcss/vite:generate:serve',
	'@tailwindcss/vite:generate:build',
])

type TransformHook = Plugin['transform']
type TransformHookHandler = HookHandler<NonNullable<TransformHook>>

function getTransformHandler(transform: TransformHook): TransformHookHandler | undefined {
	if (!transform) return undefined
	if (typeof transform === 'function') return transform
	if (typeof transform === 'object' && typeof transform.handler === 'function') {
		return transform.handler
	}
	return undefined
}

function setTransformHandler(
	plugin: Plugin,
	transform: TransformHook,
	handler: TransformHookHandler
): void {
	if (typeof transform === 'function') {
		plugin.transform = handler
		return
	}
	if (transform && typeof transform === 'object') {
		plugin.transform = { ...transform, handler }
	}
}

function wrapTailwindPlugin(plugin: Plugin, root: string, clientDir: string): void {
	if (!plugin.name || !TAILWIND_GENERATE.has(plugin.name)) return
	const transform = plugin.transform
	const original = getTransformHandler(transform)
	if (!original) return

	const wrapped: TransformHookHandler = async function (this, code, id) {
		try {
			return await original.call(this, code, id)
		} catch (err) {
			const resolveCss = async (spec: string, importerBase: string) => {
				const importer = path.join(importerBase, '__aero_css_resolve.css')
				const resolved = await this.resolve(spec, importer)
				if (!resolved?.id) return false
				const cleaned = resolved.id.replace(/^\0+/, '').split('?')[0]!
				// Vite may resolve `tailwindcss` to optimized JS under `.vite/deps`; that is not CSS.
				if (cleaned.includes('/node_modules/.vite/deps/')) return false
				return cleaned
			}
			throw await enrichCssSyntaxError(err, {
				root,
				entryCode: code,
				entryId: id,
				candidateFiles: collectClientStyleCssFiles(root, clientDir),
				resolveCss,
			})
		}
	}

	setTransformHandler(plugin, transform, wrapped)
}

/**
 * Plugin that patches Tailwind generate hooks after the full config is resolved
 * (Tailwind is often merged in after Aero via `mergeConfig`).
 */
export function aeroCssErrorLocationPlugin(clientDir: string): Plugin {
	return {
		name: 'vite-plugin-aero-css-error-location',
		configResolved(config) {
			for (const plugin of config.plugins) {
				if (!plugin || typeof plugin !== 'object') continue
				wrapTailwindPlugin(plugin as Plugin, config.root, clientDir)
			}
		},
	}
}
