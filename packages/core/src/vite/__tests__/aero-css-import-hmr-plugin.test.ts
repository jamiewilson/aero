import { describe, expect, it } from 'vitest'
import type { ModuleNode } from 'vite'
import {
	aeroCssImportHmrPlugin,
	collectSelfAcceptingCssImporters,
} from '../aero-css-import-hmr-plugin'

function mod(partial: {
	id?: string | null
	url?: string
	type?: ModuleNode['type']
	isSelfAccepting?: boolean
	importers?: Set<ModuleNode>
}): ModuleNode {
	return {
		id: partial.id ?? null,
		url: partial.url ?? '/x.css',
		type: partial.type ?? 'js',
		isSelfAccepting: partial.isSelfAccepting ?? false,
		importers: partial.importers ?? new Set(),
	} as ModuleNode
}

describe('collectSelfAcceptingCssImporters', () => {
	it('finds self-accepting css parents of asset-only import deps', () => {
		const direct = mod({
			id: '/styles/global.css?direct',
			url: '/styles/global.css?direct',
			type: 'css',
			isSelfAccepting: true,
		})
		const asset = mod({
			id: null,
			url: '/@fs/styles/code.css',
			type: 'asset',
			importers: new Set([direct]),
		})

		expect(collectSelfAcceptingCssImporters([asset])).toEqual([direct])
	})

	it('returns empty when no css HMR boundary exists', () => {
		const orphan = mod({ type: 'asset', id: null })
		expect(collectSelfAcceptingCssImporters([orphan])).toEqual([])
	})
})

describe('aeroCssImportHmrPlugin', () => {
	it('remaps asset-only css hot updates to parent css modules', () => {
		const plugin = aeroCssImportHmrPlugin()
		const hotUpdate = plugin.hotUpdate
		expect(typeof hotUpdate).toBe('function')
		const handler = typeof hotUpdate === 'function' ? hotUpdate : hotUpdate?.handler
		expect(handler).toBeTypeOf('function')

		const direct = mod({
			id: '/styles/global.css?direct',
			url: '/styles/global.css?direct',
			type: 'css',
			isSelfAccepting: true,
		})
		const asset = mod({
			id: null,
			url: '/@fs/styles/code.css',
			type: 'asset',
			importers: new Set([direct]),
		})

		const result = (handler as Function).call(
			{ environment: { name: 'client' } },
			{
				file: '/styles/code.css',
				modules: [asset],
				timestamp: Date.now(),
				read: async () => '',
				server: {},
			}
		)

		expect(result).toEqual([direct])
	})

	it('ignores non-css files and mixed module graphs', () => {
		const plugin = aeroCssImportHmrPlugin()
		const handler =
			typeof plugin.hotUpdate === 'function' ? plugin.hotUpdate : plugin.hotUpdate?.handler

		const css = mod({
			id: '/styles/global.css?direct',
			type: 'css',
			isSelfAccepting: true,
		})
		expect(
			(handler as Function).call(
				{ environment: { name: 'client' } },
				{ file: '/page.html', modules: [css] }
			)
		).toBeUndefined()

		expect(
			(handler as Function).call(
				{ environment: { name: 'client' } },
				{ file: '/styles/global.css', modules: [css] }
			)
		).toBeUndefined()
	})
})
