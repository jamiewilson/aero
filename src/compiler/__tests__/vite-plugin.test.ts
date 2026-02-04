import { describe, it, expect } from 'vitest'
import path from 'path'
import { tbd } from '@src/vite'
import { TBD } from '@src/runtime'

describe('Vite Plugin Integration', () => {
	const plugin: any = tbd()

	plugin.configResolved({ root: process.cwd() })

	it('should transform html into a js module', async () => {
		const html = `
            <script on:build>
                const title = 'Vite Test';
            </script>
            <h1>{ title }</h1>
        `
		const id = '/src/pages/test.html'

		const result: any = plugin.transform(html, id)
		expect(result.code).toContain('export default async function(tbd)')
		expect(result.code).toContain('Vite Test')
	})

	it('should handle on:client via virtual modules', async () => {
		const html = `
            <script on:client>
                console.log('client side');
            </script>
            <div>Client</div>
        `
		const id = path.join(process.cwd(), 'src/pages/client.html')

		// 1. Transform the HTML – client script URL is root-relative and .js (no user path, no .html)
		const result: any = plugin.transform(html, id)
		expect(result.code).toContain('/@tbd/client/')
		expect(result.code).toContain('src/pages/client.js')
		expect(result.code).not.toMatch(/\/Users\/[^"'\s]+\.html/)

		// 2. Resolve and load the virtual module (Vite uses \0 prefix for virtual module IDs)
		const relativePath = path
			.relative(process.cwd(), id)
			.replace(/\\/g, '/')
			.replace(/\.html$/i, '.js')
		const virtualId = '/@tbd/client/' + relativePath
		const resolvedId = await plugin.resolveId(virtualId)
		expect(resolvedId).toBe('\0' + virtualId)

		const loadedContent = plugin.load(resolvedId)
		expect(loadedContent).toContain("console.log('client side')")
	})

	it('should render a transformed module using the runtime', async () => {
		const html = '<h1>{ tbd.props.title }</h1>'
		const id = '/src/pages/props.html'
		const result: any = plugin.transform(html, id)
		const tbd = new TBD()
		const bodyStart = result.code.indexOf('{')
		const bodyEnd = result.code.lastIndexOf('}')
		const body = result.code.substring(bodyStart + 1, bodyEnd)
		const renderFn = new (Object.getPrototypeOf(async function () {}).constructor)('tbd', body)

		const finalOutput = await tbd.render(renderFn, { title: 'Dynamic Title' })
		expect(finalOutput).toBe('<h1>Dynamic Title</h1>')
	})
})
