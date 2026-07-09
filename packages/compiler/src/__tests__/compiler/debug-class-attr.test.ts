import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

describe('debug class attribute resolution', () => {
	it('does not resolve bare class names as npm modules', () => {
		const root = path.resolve(import.meta.dirname, '../../../../../examples/kitchen-sink')
		const importer = path.join(root, 'client/layouts/base.html')
		const debugPkg = path.join(root, 'node_modules/debug/src/index.js')
		const resolvePath = (specifier: string) => (specifier === 'debug' ? debugPkg : specifier)
		const html = '<body class="debug">hi</body>'
		const code = compile(parse(html), { root, resolvePath, importer })
		expect(code).toContain('class="debug"')
		expect(code).not.toContain('node_modules')
	})

	it('still resolves path-like attribute values', () => {
		const root = path.resolve(import.meta.dirname, '../../../../../examples/kitchen-sink')
		const importer = path.join(root, 'client/layouts/base.html')
		const resolvePath = (specifier: string) =>
			specifier === '@styles/global.css' ? path.join(root, 'client/assets/styles/global.css') : specifier
		const html = '<link rel="stylesheet" href="@styles/global.css" />'
		const code = compile(parse(html), { root, resolvePath, importer })
		expect(code).toContain('href="/client/assets/styles/global.css"')
	})
})
