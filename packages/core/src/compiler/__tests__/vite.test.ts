/**
 * Integration tests for the Aero Vite plugin: transform (HTML → JS module), resolveId/load for
 * virtual client scripts, props preamble injection, rendering via Aero runtime,
 * resolveId for extensionless .html, and buildStart prefill.
 * HMR for templates/content is dependency-driven; plain in-template client scripts also register
 * a focused handleHotUpdate path so script changes refresh without restarting dev server.
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
	const configResult = configPlugin.config({ root: process.cwd() }, { command: 'serve' })
	configPlugin.configResolved({ root: process.cwd(), command: 'serve' })

	it('configures environments.ssr for Environment API parity with build', () => {
		expect(configResult).toBeDefined()
		expect(configResult?.environments).toBeDefined()
		expect(configResult?.environments?.ssr).toBeDefined()
		const ssr = configResult?.environments?.ssr as { dev?: { createEnvironment?: unknown } }
		expect(typeof ssr.dev?.createEnvironment).toBe('function')
		expect(configResult?.customLogger).toBeDefined()
	})

	const viteErrorRef: {
		current: { message: string; loc?: { line: number; column: number } } | null
	} = { current: null }
	const pluginCtx = {
		error(msg: string | { message: string; loc?: { line: number; column: number } }) {
			if (typeof msg === 'string') {
				viteErrorRef.current = { message: msg }
				throw new Error(msg)
			}
			viteErrorRef.current = { message: msg.message, loc: msg.loc }
			throw new Error(msg.message)
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
		expect(result.code).toContain('client/pages/plain.ts')
		expect(result.code).toMatch(/scripts\?\.add\(.*script.*src/)
		expect(result.code).not.toContain('import { allCaps }')
		const virtualId = '\0/@aero/client/client/pages/plain.ts'
		const loadedContent = virtualsPlugin.load(virtualId)
		expect(loadedContent).toContain('allCaps')
		expect(loadedContent).toContain("console.log(allCaps('plain'))")
	})

	it('injects props preamble that reads from window.__aero_data_next (set by inline bridge before module runs)', async () => {
		const html = `
            <script props="{ { isHomepage } }">
                console.log(isHomepage);
            </script>
            <div>Content</div>
        `
		const id = path.join(process.cwd(), 'client/pages/home.html')
		transformPlugin.transform.call(pluginCtx, html, id)

		const virtualId = '\0/@aero/client/client/pages/home.ts'
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
		const renderFn = new (Object.getPrototypeOf(async function () {}).constructor)('Aero', body)

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
		const result = await virtualsPlugin.resolveId.call(
			resolveCtx,
			'@components/header.html',
			undefined
		)
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
			'@aero-js/content/render',
			undefined
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
			'utf-8'
		)
		try {
			configPlugin.config({ root: tmpDir })
			configPlugin.configResolved({ root: tmpDir })
			virtualsPlugin.buildStart?.()
			const virtualId = '\0/@aero/client/client/pages/prefill-test.ts'
			const loaded = virtualsPlugin.load(virtualId)
			expect(loaded).toContain(unique)
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true })
			configPlugin.config({ root: process.cwd() })
			configPlugin.configResolved({ root: process.cwd() })
		}
	})

	it('should use .ts extension for virtual client script URLs so Vite transpiles TypeScript', async () => {
		const html = `
<script is:build>const x = 1;</script>
<div>Content</div>
<script>
	const msg: string = 'typed';
	console.log(msg);
</script>
`
		const id = path.join(process.cwd(), 'client/pages/typed.html')
		const result: any = transformPlugin.transform.call(pluginCtx, html, id)

		expect(result.code).toContain('client/pages/typed.ts')
		expect(result.code).not.toContain('client/pages/typed.js')

		const virtualId = '\0/@aero/client/client/pages/typed.ts'
		const loadedContent = virtualsPlugin.load(virtualId)
		expect(loadedContent).toContain("const msg: string = 'typed'")
	})

	it('registers handleHotUpdate and refreshes virtual client script entries for html edits', async () => {
		const withHandleHotUpdate = plugins.some((p: any) => typeof p?.handleHotUpdate === 'function')
		expect(withHandleHotUpdate).toBe(true)

		const id = path.join(process.cwd(), 'client/pages/hot-script.html')
		transformPlugin.transform.call(pluginCtx, `<div>v1</div><script>console.log('V1')</script>`, id)

		const virtualId = '\0/@aero/client/client/pages/hot-script.ts'
		expect(virtualsPlugin.load(virtualId)).toContain("console.log('V1')")

		const moduleNode = { id: virtualId }
		const sends: any[] = []
		const invalidated: any[] = []
		const result = await virtualsPlugin.handleHotUpdate({
			file: id,
			read: async () => `<div>v2</div><script>console.log('V2')</script>`,
			server: {
				ws: { send: (payload: any) => sends.push(payload) },
				moduleGraph: {
					getModuleById: (moduleId: string) => (moduleId === virtualId ? moduleNode : null),
					invalidateModule: (mod: any) => invalidated.push(mod),
				},
			},
			modules: [],
		})

		expect(result).toEqual([])
		expect(virtualsPlugin.load(virtualId)).toContain("console.log('V2')")
		expect(invalidated).toContain(moduleNode)
		expect(sends).toContainEqual({ type: 'full-reload' })
	})

	it('transform surfaces [AERO_COMPILE] when compile throws', () => {
		viteErrorRef.current = null
		const html = `<script is:build>
	const items = ['a', 'b'];
</script>
<ul>
	<li each="item in items">{ item }</li>
</ul>`
		const id = path.join(process.cwd(), 'client/pages/bad-each.html')
		expect(() => transformPlugin.transform.call(pluginCtx, html, id)).toThrow()
		type ViteErr = { message: string; loc?: { line: number; column: number } }
		const recorded = viteErrorRef.current as ViteErr | null
		expect(recorded).not.toBeNull()
		expect(recorded!.message).toContain('[AERO_COMPILE]')
		expect(recorded!.message).toMatch(/each|brace/i)
		expect(recorded!.loc).toMatchObject({
			file: id,
			line: 5,
			column: 5,
		})
	})
})
