/**
 * Integration tests for the Aero Vite plugin: transform (HTML → JS module), resolveId/load for
 * virtual client scripts, pass:data preamble injection, rendering via Aero runtime,
 * resolveId for extensionless .html, and buildStart prefill.
 * HMR for templates and content is dependency-driven (no custom handleHotUpdate); the app uses
 * a single client entry that imports @aero-ssg/core and calls aero.mount().
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Aero } from '../../runtime'
import { aero } from '../../vite'
import { AERO_HTML_VIRTUAL_PREFIX } from '../../vite/defaults'

describe('Vite Plugin Integration', () => {
	const plugins: any[] = aero()
	const configPlugin = plugins.find((p: any) => p.config)
	const transformPlugin = plugins.find((p: any) => p.transform)
	const virtualsPlugin = plugins.find((p: any) => p.load)

	// Simulate the real Vite lifecycle: config() → configResolved()
	configPlugin.config({ root: process.cwd() })
	configPlugin.configResolved({ root: process.cwd(), command: 'serve' })

	const pluginCtx = {
		error(msg: string) {
			throw new Error(msg)
		},
		resolve: async () => null,
	}

	it('should transform html into a js module', async () => {
		const html = `
            <script is:build>
                const title = 'Vite Test';
            </script>
            <h1>{ title }</h1>
        `
		const id = '/aero/pages/test.html'

		const result: any = transformPlugin.transform.call(pluginCtx, html, id)
		expect(result.code).toContain('export default async function(Aero)')
		expect(result.code).toContain('Vite Test')
	})

	it('should treat plain <script> (no is:inline) as default client and emit virtual script URL', async () => {
		const html = `
<script is:build>const x = 1;</script>
<div>Content</div>
<script>
	import { allCaps } from '@scripts/utils/transform'
	console.log(allCaps('plain'))
</script>
`
		const id = path.join(process.cwd(), 'client/pages/plain.html')
		const result: any = transformPlugin.transform.call(pluginCtx, html, id)
		expect(result.code).toContain('@aero/client')
		expect(result.code).toContain('client/pages/plain.js')
		expect(result.code).toMatch(/scripts\?\.add\(.*script.*src/)
		expect(result.code).not.toContain('import { allCaps }')
		const virtualId = '\0/@aero/client/client/pages/plain.js'
		const loadedContent = virtualsPlugin.load(virtualId)
		expect(loadedContent).toContain('allCaps')
		expect(loadedContent).toContain("console.log(allCaps('plain'))")
	})

	it('injects pass:data preamble that reads from window.__aero_data_next (set by inline bridge before module runs)', async () => {
		const html = `
            <script pass:data="{ { isHomepage } }">
                console.log(isHomepage);
            </script>
            <div>Content</div>
        `
		const id = path.join(process.cwd(), 'client/pages/home.html')
		transformPlugin.transform.call(pluginCtx, html, id)

		const virtualId = '\0/@aero/client/client/pages/home.js'
		const loadedContent = virtualsPlugin.load(virtualId)
		expect(loadedContent).toContain('window.__aero_data_next')
		expect(loadedContent).toContain('delete window.__aero_data_next')
		expect(loadedContent).toContain('const { isHomepage } = __aero_data')
		expect(loadedContent).toContain('console.log(isHomepage)')
	})

	it('should render a transformed module using the runtime', async () => {
		const html = '<h1>{ Aero.props.title }</h1>'
		const id = '/aero/pages/props.html'
		const result: any = transformPlugin.transform.call(pluginCtx, html, id)
		const aeroInstance = new Aero()
		const bodyStart = result.code.indexOf('{')
		const bodyEnd = result.code.lastIndexOf('}')
		const body = result.code.substring(bodyStart + 1, bodyEnd)
		const renderFn = new (Object.getPrototypeOf(async function () {}).constructor)(
			'Aero',
			body,
		)

		const finalOutput = await aeroInstance.render(renderFn, {
			props: { title: 'Dynamic Title' },
		})
		expect(finalOutput).toBe('<h1>Dynamic Title</h1>')
	})

	it('should resolve path-like extensionless imports to .html via resolveId', async () => {
		const resolvedHtmlPath = path.join(process.cwd(), 'client/components/header.html')
		const resolveCtx = {
			...pluginCtx,
			resolve: async (id: string) => {
				if (id === '@components/header') return null
				if (id === '@components/header.html') return { id: resolvedHtmlPath }
				return null
			},
		}
		// In dev (command: serve) we keep the real path so file watcher and transform work (HMR + fresh SSR)
		const result = await virtualsPlugin.resolveId.call(resolveCtx, '@components/header', undefined)
		expect(result).toBeDefined()
		expect((result as { id: string }).id).toBe(resolvedHtmlPath)
	})

	it('should resolve Aero template .html to virtual id in build so vite:build-html never sees them', async () => {
		configPlugin.configResolved({ root: process.cwd(), command: 'build' })
		const resolvedHtmlPath = path.join(process.cwd(), 'client/components/header.html')
		const resolveCtx = {
			...pluginCtx,
			resolve: async (id: string) => {
				if (id === '@components/header.html') return { id: resolvedHtmlPath }
				return null
			},
		}
		const result = await virtualsPlugin.resolveId.call(resolveCtx, '@components/header.html', undefined)
		expect(result).toBe(AERO_HTML_VIRTUAL_PREFIX + resolvedHtmlPath.replace(/\.html$/i, '.aero'))
		configPlugin.configResolved({ root: process.cwd(), command: 'serve' })
	})

	it('should not resolve package specifiers to .html (path-like check)', async () => {
		const resolveCtx = {
			...pluginCtx,
			resolve: async () => null,
		}
		const result = await virtualsPlugin.resolveId.call(
			resolveCtx,
			'@aero-ssg/content/render',
			undefined,
		)
		expect(result).toBeNull()
	})

	it('prefills clientScripts in buildStart so load can serve discovered client scripts', () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-vite-test-'))
		const clientDir = path.join(tmpDir, 'client', 'pages')
		fs.mkdirSync(clientDir, { recursive: true })
		const htmlPath = path.join(clientDir, 'prefill-test.html')
		const unique = 'PREFILL_CLIENT_SCRIPT_CONTENT'
		fs.writeFileSync(
			htmlPath,
			`<script is:build>const x = 1;</script><div>Static</div><script>${unique}</script>`,
			'utf-8',
		)
		try {
			configPlugin.config({ root: tmpDir })
			configPlugin.configResolved({ root: tmpDir })
			virtualsPlugin.buildStart?.()
			const virtualId = '\0/@aero/client/client/pages/prefill-test.js'
			const loaded = virtualsPlugin.load(virtualId)
			expect(loaded).toContain(unique)
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true })
			configPlugin.config({ root: process.cwd() })
			configPlugin.configResolved({ root: process.cwd() })
		}
	})

	it('does not register a custom HMR plugin (handleHotUpdate); HMR is dependency-driven via single client entry', () => {
		const withHandleHotUpdate = plugins.some((p: any) => typeof p?.handleHotUpdate === 'function')
		expect(withHandleHotUpdate).toBe(false)
	})
})
