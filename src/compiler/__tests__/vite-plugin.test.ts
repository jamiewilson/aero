import { describe, it, expect } from 'vitest'
import { tbd } from '@src/vite'
import { TBD } from '@src/runtime'

describe('Vite Plugin Integration', () => {
	const plugin: any = tbd()

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
		const id = '/src/pages/client.html'

		// 1. Transform the HTML
		const result: any = plugin.transform(html, id)
		expect(result.code).toContain('client.html?on-client')

		// 2. Load the virtual module
		const virtualId = `${id}?on-client`
		const resolvedId = plugin.resolveId(virtualId)
		expect(resolvedId).toBe(virtualId)

		const loadedContent = plugin.load(virtualId)
		expect(loadedContent).toContain("console.log('client side')")
	})

	it('should render a transformed module using the runtime', async () => {
		const html = '<h1>{ tbd.props.title }</h1>'
		const id = '/src/pages/props.html'

		const result: any = plugin.transform(html, id)

		const tbd = new TBD()

		// Actually, the test was manually executing the code.
		// Let's just fix the execution logic.
		const bodyStart = result.code.indexOf('{')
		const bodyEnd = result.code.lastIndexOf('}')
		const body = result.code.substring(bodyStart + 1, bodyEnd)
		const renderFn = new (Object.getPrototypeOf(async function () {}).constructor)('tbd', body)

		const finalOutput = await tbd.render(renderFn, { title: 'Dynamic Title' })
		expect(finalOutput).toBe('<h1>Dynamic Title</h1>')
	})
})
