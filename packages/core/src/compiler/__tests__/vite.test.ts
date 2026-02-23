/**
 * Integration tests for the Aero Vite plugin: transform (HTML → JS module), resolveId/load for
 * virtual client scripts, pass:data preamble injection, and rendering via Aero runtime.
 * Uses the split plugins (config, virtuals, transform) with a minimal mock context.
 */

import { describe, it, expect } from 'vitest'
import { Aero } from '../../runtime'
import { aero } from '../../vite'
import path from 'path'

describe('Vite Plugin Integration', () => {
	const plugins: any[] = aero()
	const configPlugin = plugins.find((p: any) => p.config)
	const transformPlugin = plugins.find((p: any) => p.transform)
	const virtualsPlugin = plugins.find((p: any) => p.load)

	// Simulate the real Vite lifecycle: config() → configResolved()
	configPlugin.config({ root: process.cwd() })
	configPlugin.configResolved({ root: process.cwd() })

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
		expect(result.code).toContain('/@aero/client/')
		expect(result.code).toContain('client/pages/plain.js')
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

	// TODO: resolveId for .html imports without extension, buildStart/clientScripts prefill, handleHotUpdate not covered.
})
