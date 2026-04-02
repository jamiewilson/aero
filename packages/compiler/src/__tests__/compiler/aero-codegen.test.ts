/**
 * Unit tests for Aero codegen features (clientScripts, blockingScripts, props on script elements).
 */

import { describe, it, expect } from 'vitest'
import { escapeScriptJson } from '../../helpers'
import { parse } from '../../parser'
import { compile } from '../../codegen'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

/** Execute the generated render function */
async function execute(code: string, context: Record<string, any> = {}) {
	const defaultIdx = code.indexOf('export default async function')
	const renderCode = defaultIdx >= 0 ? code.slice(defaultIdx) : code

	const bodyStart = renderCode.indexOf('{')
	const bodyEnd = renderCode.lastIndexOf('}')
	const body = renderCode.substring(bodyStart + 1, bodyEnd)

	const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
	const renderFn = new AsyncFunction('Aero', body)

	let _passDataId = 0
	const createScriptTag = (attrs: string, src: string) => {
		const normalizedAttrs = attrs.trim()
		const escapedSrc = src
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
		return `<script${normalizedAttrs ? ' ' + normalizedAttrs : ''} src="${escapedSrc}"></script>`
	}
	const aeroContext = {
		scripts: new Set<string>(),
		headScripts: new Set<string>(),
		styles: new Set<string>(),
		nextPassDataId: () => `__aero_${_passDataId++}`,
		renderComponent: async () => '',
		createScriptTag,
		page: {
			url: new URL('http://localhost'),
			request: new Request('http://localhost'),
			params: {},
		},
		slots: {},
		props: {},
		escapeScriptJson,
		...context,
	}
	return await renderFn(aeroContext)
}

describe('Aero Codegen - Client Scripts', () => {
	it('should allow external scripts with src attribute', async () => {
		const html = `<script src="https://example.com/script.js"></script>
								<div>Content</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const scripts = new Set<string>()
		await execute(code, { scripts })

		const code2 = compile(parsed, {
			...mockOptions,
			clientScripts: [
				{
					attrs: 'src="https://example.com/script.js"',
					content: '/virtual.js',
				},
			],
		})
		const scripts2 = new Set<string>()
		await execute(code2, { scripts: scripts2 })
		expect(Array.from(scripts2).some(s => s.includes('src="/virtual.js"'))).toBe(true)
	})

	it('should inject clientScripts if provided', async () => {
		const html = '<div>Content</div>'

		const parsed = parse(html)
		const code = compile(parsed, {
			...mockOptions,
			clientScripts: [{ attrs: '', content: '/test.js' }],
		})

		const scripts = new Set<string>()
		await execute(code, { scripts })
		expect(scripts.has('<script type="module" src="/test.js"></script>')).toBe(true)
	})

	it('should inject clientScripts with injectInHead into headScripts', async () => {
		const html = '<div>Content</div>'

		const parsed = parse(html)
		const code = compile(parsed, {
			...mockOptions,
			clientScripts: [{ attrs: '', content: '/test.js', injectInHead: true }],
		})

		const headScripts = new Set<string>()
		await execute(code, { headScripts })

		expect(headScripts.has('<script type="module" src="/test.js"></script>')).toBe(true)
	})

	it('should inject plain script in head from component render', async () => {
		const layoutHtml = `<html><head><script>
			import { helper } from './helper.js'
			console.log(helper());
		</script></head><body>Content</body></html>`

		const parsed = parse(layoutHtml)
		expect(parsed.clientScripts).toHaveLength(1)
		expect(parsed.clientScripts[0].injectInHead).toBe(true)

		const code = compile(parsed, {
			...mockOptions,
			clientScripts: parsed.clientScripts,
		})

		const scripts = new Set<string>()
		const headScripts = new Set<string>()
		await execute(code, { scripts, headScripts })

		expect(Array.from(headScripts).some(s => s.includes('console.log(helper());'))).toBe(true)
	})
})

describe('Aero Codegen - Props (script/style)', () => {
	it('should pass data to client default scripts as global properties without block scoping them', async () => {
		const html = `<script is:build>
								const config = { theme: 'dark', id: 42 };
							</script>
							<script props="{ config }">
								console.log(config.theme);
							</script>`

		const parsed = parse(html)
		const code = compile(parsed, {
			...mockOptions,
			clientScripts: [{ attrs: '', content: '/auto.js', passDataExpr: '{ config }' }],
		})

		const scripts = new Set<string>()
		await execute(code, { scripts })
		const out = Array.from(scripts).join('\n')

		expect(out).toContain('type="application/json"')
		expect(out).toContain('class="__aero_data"')
		expect(out).toContain('{"config":{"theme":"dark","id":42}}')
		expect(out).toContain('window.__aero_data_next=')
		expect(out).toContain('document.currentScript')
		expect(out).not.toContain('document.getElementById')
		expect(out).not.toContain('nextPassDataId')
		expect(out).toContain('<script type="module" src="/auto.js"></script>')
	})

	it('should pass data to inline scripts with variable injection', async () => {
		const html = `<script is:build>
								const config = { theme: 'dark' };
							</script>
							<script is:inline props="{ config }">
								console.log(config.theme);
							</script>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('console.log(config.theme);')
	})

	it('should pass data to blocking scripts in head', async () => {
		const html = `<script is:build>
								const config = { theme: 'dark' };
							</script>
							<script is:blocking props="{ config }">
								console.log(config.theme);
							</script>`

		const parsed = parse(html)
		const code = compile(parsed, {
			...mockOptions,
			blockingScripts: parsed.blockingScripts,
		})

		const headScripts = new Set<string>()
		await execute(code, { headScripts })
		const out = Array.from(headScripts).join('\n')

		expect(out).toContain('const config = {"theme":"dark"};')
		expect(out).toContain('console.log(config.theme);')
	})

	it('should strip props attribute from rendered output when using default client bundling', async () => {
		const html = `<script is:build>
								const val = 1;
							</script>
							<script props="{ val }">
								console.log(val);
							</script>`

		const parsed = parse(html)
		const code = compile(parsed, {
			...mockOptions,
			clientScripts: [{ attrs: '', content: '/virtual.js', passDataExpr: '{ val }' }],
		})

		const scripts = new Set<string>()
		const output = await execute(code, { scripts })
		const out = Array.from(scripts).join('\n')

		expect(output).not.toContain('props=')
		expect(out).toContain('window.__aero_data_next=')
		expect(out).toContain('document.currentScript')
		expect(out).not.toContain('document.getElementById')
	})

	it('should throw when props value is not brace-wrapped', async () => {
		const html = `<script is:build>
								const config = {};
							</script>
							<script is:blocking props="config">
								console.log(config);
							</script>`

		const parsed = parse(html)
		expect(() =>
			compile(parsed, {
				...mockOptions,
				blockingScripts: parsed.blockingScripts,
			})
		).toThrow('Directive `props` on <script> must use a braced expression')
	})

	it('should emit JSON data tag before bundled module script', async () => {
		const html = `<script is:build>
								const val = 1;
							</script>
							<script props="{ val }">
								console.log(val);
							</script>`

		const parsed = parse(html)
		const code = compile(parsed, {
			...mockOptions,
			clientScripts: [{ attrs: '', content: '/virtual.js', passDataExpr: '{ val }' }],
		})

		const scripts = new Set<string>()
		await execute(code, { scripts })
		const out = Array.from(scripts).join('\n')

		expect(out.indexOf('type="application/json"')).toBeLessThan(out.indexOf('type="module"'))
	})
})

describe('Aero Codegen - Blocking Scripts', () => {
	it('should strip TypeScript from blocking scripts', async () => {
		const html = `<script is:build>
			const config = { theme: 'dark' };
		</script>
		<script is:blocking>
			const x: number = 1;
			console.log(x);
		</script>`

		const parsed = parse(html)
		const code = compile(parsed, {
			...mockOptions,
			blockingScripts: parsed.blockingScripts,
		})

		const headScripts = new Set<string>()
		await execute(code, { headScripts })
		const out = Array.from(headScripts).join('\n')

		expect(out).toContain('console.log(x)')
		expect(out).not.toContain(': number')
	})
})
