import { describe, it, expect } from 'vitest'
import { Aero } from '../../runtime'
import { aero } from '../../vite'
import path from 'path'

describe('Vite Plugin Integration', () => {
	const plugins: any[] = aero()
	const plugin: any = plugins[0]

	// Simulate the real Vite lifecycle: config() → configResolved()
	plugin.config({ root: process.cwd() })
	plugin.configResolved({ root: process.cwd() })

	// Mock the Vite plugin context methods used by the plugin
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

		const result: any = plugin.transform.call(pluginCtx, html, id)
		expect(result.code).toContain('export default async function(Aero)')
		expect(result.code).toContain('Vite Test')
	})

	it('should handle is:bundled via virtual modules', async () => {
		const html = `
            <script is:bundled>
                console.log('client side');
            </script>
            <div>Client</div>
        `
		const id = path.join(process.cwd(), 'aero/pages/client.html')

		// 1. Transform the HTML – client script URL is root-relative and .js (no user path, no .html)
		const result: any = plugin.transform.call(pluginCtx, html, id)
		expect(result.code).toContain('/@aero/client/')
		expect(result.code).toContain('aero/pages/client.js')
		expect(result.code).not.toMatch(/\/Users\/[^"'\s]+\.html/)

		// 2. Resolve and load the virtual module (Vite uses \0 prefix for virtual module IDs)
		const relativePath = path
			.relative(process.cwd(), id)
			.replace(/\\/g, '/')
			.replace(/\.html$/i, '.js')
		const virtualId = '/@aero/client/' + relativePath
		const resolvedId = await plugin.resolveId.call(pluginCtx, virtualId)
		expect(resolvedId).toBe('\0' + virtualId)

		const loadedContent = plugin.load(resolvedId)
		expect(loadedContent).toContain("console.log('client side')")
	})

	it('should render a transformed module using the runtime', async () => {
		const html = '<h1>{ Aero.props.title }</h1>'
		const id = '/aero/pages/props.html'
		const result: any = plugin.transform.call(pluginCtx, html, id)
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
})
