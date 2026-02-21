import { describe, it, expect } from 'vitest'
import { parse } from '../parser'
import { compile } from '../codegen'
import { extractGetStaticPaths } from '../helpers'

// Helper to execute the generated code
async function execute(code: string, context = {}) {
	// Generate the wrapper function
	// We expect the code to contain `export default async function(Aero) { ... }`
	// and optionally a preceding `export ... function getStaticPaths(...) { ... }`

	// Find the render function (export default)
	const defaultIdx = code.indexOf('export default async function')
	const renderCode = defaultIdx >= 0 ? code.slice(defaultIdx) : code

	// Robust replacement: find the function body
	const bodyStart = renderCode.indexOf('{')
	const bodyEnd = renderCode.lastIndexOf('}')
	const body = renderCode.substring(bodyStart + 1, bodyEnd)

	// Create an actual AsyncFunction
	const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
	const renderFn = new AsyncFunction('Aero', body)

	return await renderFn(context)
}

const mockOptions = {
	root: '/' /* What is this?? */,
	resolvePath: (v: string) => v,
}

describe('Codegen', () => {
	it('should compile simple interpolation', async () => {
		const html = `<script is:build>
										title = 'Hello World';
									</script>
									<h1>{ title }</h1>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('<h1>Hello World</h1>')
	})

	it('should compile attribute interpolation', async () => {
		const html = `<script is:build>
										const cls = 'active';
									</script>
									<div class="{ cls }"></div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('<div class="active"></div>')
	})

	it('should handle missing script', async () => {
		const html = '<div>Static</div>'

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toBe('<div>Static</div>')
	})

	it('should compile data-each loops', async () => {
		const html = `<script is:build>
										const items = ['a', 'b'];
									</script>
									<ul>
										<li data-each="{ item in items }">{ item }</li>
									</ul>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		// Normalize whitespace for easier comparison if needed, but contain should work
		expect(output).toContain('<li>a</li>')
		expect(output).toContain('<li>b</li>')
		expect(output).not.toContain('data-each')
	})

	it('should throw when each value is not brace-wrapped', async () => {
		const html = `<script is:build>
										const items = ['a', 'b'];
									</script>
									<ul>
										<li each="item in items">{ item }</li>
									</ul>`

		const parsed = parse(html)
		expect(() => compile(parsed, mockOptions)).toThrow(
			'Directive `each` on <li> must use a braced expression',
		)
	})

	it('should resolve component tags', async () => {
		const html = `<script is:build>
										const myComp = { name: 'my-comp' };
									</script>
									<my-comp-component />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		// Mock Aero context with renderComponent
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				return `<div class="mock-rendered">${comp.name}</div>`
			},
		}

		const output = await execute(code, Aero)
		expect(output).toContain('<div class="mock-rendered">my-comp</div>')
		expect(output).not.toContain('<my-comp-component')
	})

	it('should pass props and support shorthand', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
										const someProps = { title: 'External' };
										const props = { theme: 'dark' };
									</script>
									<my-comp-component
										title="Local" item="{ 'a' }"
										data-props="{ ...someProps }" />
									<my-comp-component data-props />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)

		// First call: { ...someProps, title: "Local", item: 'a' }
		expect(renderedProps[0]).toEqual({ title: 'Local', item: 'a' })
		// Second call (shorthand): { ...props } -> { theme: 'dark' }
		expect(renderedProps[1]).toEqual({ theme: 'dark' })
	})

	it('should interpolate mixed component prop strings', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
										const slug = 'docs-1';
									</script>
									<my-comp-component title="Slug: { slug }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)
		expect(renderedProps[0]).toEqual({ title: 'Slug: docs-1' })
	})

	it('should support multiple interpolations in a component prop string', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
										const section = 'docs';
										const slug = 'intro';
									</script>
									<my-comp-component title="{ section }/{ slug }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)
		expect(renderedProps[0]).toEqual({ title: 'docs/intro' })
	})

	it('should keep full braced component prop expressions as typed values', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component count="{ 2 * 21 }" enabled="{ true }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)
		expect(renderedProps[0]).toEqual({ count: 42, enabled: true })
	})

	it('should support escaped literal braces in component prop strings via double braces', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
										const slug = 'intro';
									</script>
									<my-comp-component title="{{ slug }} + { slug }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)
		expect(renderedProps[0]).toEqual({ title: '{ slug } + intro' })
	})

	it('should support default and named slots', async () => {
		const html = `<script is:build>
										const base = { name: 'base' };
										const nav = { name: 'nav' };
									</script>
									<base-layout>
										<nav-component slot="nav" />
										<h1>Main Content</h1>
									</base-layout>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const calls: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any, slots: any) => {
				calls.push({ comp, slots })
				return comp.name || ''
			},
		}

		await execute(code, Aero)

		const baseCall = calls.find(c => c.comp.name === 'base')
		expect(baseCall.slots.nav).toContain('nav')
		expect(baseCall.slots.default).toContain('<h1>Main Content</h1>')
	})

	it('should transform static imports to dynamic imports', async () => {
		const html = `<script is:build>
										import { foo } from './fake-module'
										const res = foo;
									</script>
									<div>{ res }</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		expect(code).toContain("const { foo } = await import('./fake-module')")
		expect(code).not.toContain('import { foo } from')
	})

	it('should allow is:inline scripts and leave them in place', async () => {
		const html = `<script is:inline>console.log('inline');</script>
									<div>Content</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain("<script>console.log('inline');</script>")
		expect(output).toContain('<div>Content</div>')
	})

	it('should support pass:data on is:inline scripts', async () => {
		const html = `<script is:build>
									const config = { theme: 'dark', id: 42 };
								</script>
								<script is:inline pass:data="{ { config } }">
									console.log(config.theme);
								</script>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('const config = {"theme":"dark","id":42};')
		expect(output).toContain('console.log(config.theme);')
	})

	it('should allow external scripts with src attribute', async () => {
		const html = `<script src="https://example.com/script.js"></script>
									<div>Content</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const scripts = new Set<string>()
		await execute(code, { scripts })

		// Un-annotated src tags get extracted as client scripts and dumped to the rootScripts Set
		const code2 = compile(parsed, {
			...mockOptions,
			clientScripts: [
				{ attrs: 'src="https://example.com/script.js"', content: '/virtual.js' },
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

	it('should handle attributes with colons (Alpine.js style)', async () => {
		const html = '<button :disabled="!message.length">{ Aero.label }</button>'

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code, { label: 'Click' })
		expect(output).toContain(':disabled="!message.length"')
		expect(output).toContain('Click')
	})

	it('should normalize absolute attr paths that include parent segments', async () => {
		const html = '<form hx-post="/api/submit"></form>'
		const parsed = parse(html)
		const code = compile(parsed, {
			root: '/Users/jamie/dev/aero',
			resolvePath: () => '/../../../../api/submit',
		})

		const output = await execute(code)
		expect(output).toContain('hx-post="/api/submit"')
		expect(output).not.toContain('/../../../../api/submit')
	})

	it('should support default content in slots', async () => {
		const html = `<script is:build>
										const nav = { name: 'nav' };
									</script>
									<slot name="nav">
										<nav-component />
									</slot>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const Aero = {
			slots: {}, // Empty slots at runtime
			renderComponent: async (comp: any) => '<nav-mock />',
		}

		const output = await execute(code, Aero)
		expect(output).toContain('<nav-mock />')
	})

	it('should support inline object literals in data-props', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component data-props="{ title: 'Inline Title', count: 42 }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)
		expect(renderedProps[0]).toEqual({ title: 'Inline Title', count: 42 })
	})

	it('should support expressions in data-props', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
										const site = { meta: { title: 'Test Site' } };
									</script>
									<my-comp-component data-props="{ title: site.meta.title, doubled: 2 * 21 }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)
		expect(renderedProps[0]).toEqual({ title: 'Test Site', doubled: 42 })
	})

	it('should throw when data-props value is not brace-wrapped', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
										const myProps = { a: 1, b: 2 };
									</script>
									<my-comp-component data-props="myProps" />`

		const parsed = parse(html)
		expect(() => compile(parsed, mockOptions)).toThrow(
			'Directive `data-props` on <my-comp-component> must use a braced expression',
		)
	})

	it('should throw when if value is not brace-wrapped', async () => {
		const html = `<script is:build>
										const showLogo = true;
									</script>
									<logo-component if="showLogo" />`

		const parsed = parse(html)
		expect(() => compile(parsed, mockOptions)).toThrow(
			'Directive `if` on <logo-component> must use a braced expression',
		)
	})

	it('should throw when data-each value is not brace-wrapped', async () => {
		const html = `<script is:build>
										const items = ['a', 'b'];
									</script>
									<ul>
										<li data-each="item in items">{ item }</li>
									</ul>`

		const parsed = parse(html)
		expect(() => compile(parsed, mockOptions)).toThrow(
			'Directive `data-each` on <li> must use a braced expression',
		)
	})

	it('should merge data-props with individual attributes', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component 
										data-props="{ base: 'value' }" 
										extra="{ 'additional' }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, Aero)
		expect(renderedProps[0]).toEqual({ base: 'value', extra: 'additional' })
	})

	it('should support slot passthrough (receiving and forwarding named slots)', async () => {
		// This tests the scenario: grandparent -> parent -> child
		// where parent receives a slot and passes it through to child
		const html = `<script is:build>
										const parent = { name: 'parent' };
										const child = { name: 'child' };
									</script>
									<parent-component>
										<div slot="nav">Custom Navigation</div>
									</parent-component>`

		const parentTemplate = `<script is:build>
														const child = { name: 'child' };
													</script>
													<child-component>
														<slot name="nav" slot="nav"></slot>
													</child-component>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		// Parse parent template to see what it will pass to child
		const parsedParent = parse(parentTemplate)
		const parentCode = compile(parsedParent, mockOptions)

		const calls: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any, slots: any) => {
				calls.push({ comp, props, slots })

				// If this is the parent component, execute its template with the received slots
				if (comp.name === 'parent') {
					const bodyStart = parentCode.indexOf('{')
					const bodyEnd = parentCode.lastIndexOf('}')
					const body = parentCode.substring(bodyStart + 1, bodyEnd)
					const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
					const renderFn = new AsyncFunction('Aero', body)
					return await renderFn({ ...Aero, slots })
				}

				// For child, just return slots to verify
				if (comp.name === 'child') {
					return slots.nav || ''
				}

				return ''
			},
		}

		const output = await execute(code, Aero)

		// Verify that parent received the nav slot
		const parentCall = calls.find(c => c.comp.name === 'parent')
		expect(parentCall).toBeDefined()
		expect(parentCall.slots.nav).toContain('Custom Navigation')

		// Verify that child also received the nav slot (passed through from parent)
		const childCall = calls.find(c => c.comp.name === 'child')
		expect(childCall).toBeDefined()
		expect(childCall.slots.nav).toContain('Custom Navigation')

		// Final output should contain the navigation content
		expect(output).toContain('Custom Navigation')
	})

	it('should support hyphenated slot names', async () => {
		const html = `<script is:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component>
										<div slot="side-bar">Side Content</div>
									</my-comp-component>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const calls: any[] = []
		const Aero = {
			renderComponent: async (comp: any, props: any, slots: any) => {
				calls.push({ comp, slots })
				return ''
			},
		}

		await execute(code, Aero)

		expect(calls[0].slots['side-bar']).toContain('Side Content')
	})

	// =========================================================================
	// if/else-if/else conditional chains
	// =========================================================================

	it('should compile simple if/else chain', async () => {
		const html = `<script is:build>
										const showFirst = false;
									</script>
									<div>
										<p if="{ showFirst }">First</p>
										<p else>Fallback</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Fallback')
		expect(output).not.toContain('First')
	})

	it('should compile if/else-if/else chain (else-if matches)', async () => {
		const html = `<script is:build>
										const value = 'B';
									</script>
									<div>
										<p if="{ value === 'A' }">Option A</p>
										<p else-if="{ value === 'B' }">Option B</p>
										<p else>Default</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Option B')
		expect(output).not.toContain('Option A')
		expect(output).not.toContain('Default')
	})

	it('should compile if/else-if/else chain (else matches)', async () => {
		const html = `<script is:build>
										const value = 'C';
									</script>
									<div>
										<p if="{ value === 'A' }">Option A</p>
										<p else-if="{ value === 'B' }">Option B</p>
										<p else>Default</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)
		// console.log('GENERATED CODE:', code)

		const output = await execute(code)
		expect(output).toContain('Default')
		expect(output).not.toContain('Option A')
		expect(output).not.toContain('Option B')
	})

	it('should compile multiple else-if branches', async () => {
		const html = `<script is:build>
										const num = 3;
									</script>
									<div>
										<span if="{ num === 1 }">One</span>
										<span else-if="{ num === 2 }">Two</span>
										<span else-if="{ num === 3 }">Three</span>
										<span else>Other</span>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Three')
		expect(output).not.toContain('One')
		expect(output).not.toContain('Two')
		expect(output).not.toContain('Other')
	})

	it('should compile if/else with components', async () => {
		const html = `<script is:build>
										const showLogo = false;
										const logo = { name: 'logo' };
									</script>
									<div>
										<logo-component if="{ showLogo }" />
										<p else>No logo</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const Aero = {
			renderComponent: async (comp: any) => `<img src="${comp.name}.svg" />`,
		}

		const output = await execute(code, Aero)
		expect(output).toContain('No logo')
		expect(output).not.toContain('<img')
	})

	it('should handle if without else (standalone)', async () => {
		const html = `<script is:build>
										const show = true;
									</script>
									<div>
										<p if="{ show }">Shown</p>
										<p>Always visible</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Shown')
		expect(output).toContain('Always visible')
	})

	it('should support data- prefix for conditionals', async () => {
		const html = `<script is:build>
										const choice = 2;
									</script>
									<div>
										<p data-if="{ choice === 1 }">One</p>
										<p data-else-if="{ choice === 2 }">Two</p>
										<p data-else>Other</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Two')
		expect(output).not.toContain('One')
		expect(output).not.toContain('Other')
	})

	// =========================================================================
	// getStaticPaths extraction
	// =========================================================================

	it('should extract getStaticPaths as a named export', async () => {
		const html = `<script is:build>
										const title = 'Hello';
										export function getStaticPaths() {
											return [
												{ params: { id: 'alpha' } },
												{ params: { id: 'beta' } },
											]
										}
									</script>
									<h1>{ title }</h1>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		// Should contain the named export
		expect(code).toContain('export function getStaticPaths()')
		// Should still contain the render function
		expect(code).toContain('export default async function')
		// The render function should still work
		const output = await execute(code)
		expect(output).toContain('<h1>Hello</h1>')
	})

	it('should extract async getStaticPaths as a named export', async () => {
		const html = `<script is:build>
										export async function getStaticPaths() {
											return [{ params: { slug: 'intro' } }]
										}
									</script>
									<p>Content</p>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		expect(code).toContain('export async function getStaticPaths()')
		expect(code).toContain('export default async function')
	})

	it('should not break when there is no getStaticPaths', async () => {
		const html = `<script is:build>
										const x = 1;
									</script>
									<p>{ x }</p>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		expect(code).not.toContain('getStaticPaths')
		expect(code).toContain('export default async function')
		const output = await execute(code)
		expect(output).toContain('<p>1</p>')
	})
	// =========================================================================
	// pass:data
	// =========================================================================

	describe('pass:data', () => {
		it('should pass data to client default scripts as global properties without block scoping them', async () => {
			const html = `<script is:build>
											const config = { theme: 'dark', id: 42 };
										</script>
										<script pass:data="{ { config } }">
											console.log(config.theme);
										</script>`

			const parsed = parse(html)
			const code = compile(parsed, {
				...mockOptions,
				clientScripts: [{ attrs: '', content: '/auto.js', passDataExpr: '{ { config } }' }],
			})

			const scripts = new Set<string>()
			await execute(code, { scripts })
			const out = Array.from(scripts).join('\n')

			// Should generate a JSON bridge since it's a bundled script
			expect(out).toContain(
				'<script type="application/json" class="__aero_data">{"config":{"theme":"dark","id":42}}</script>',
			)
			// Should load the virtual module
			expect(out).toContain('<script type="module" src="/auto.js"></script>')
		})

		it('should pass data to inline scripts with variable injection', async () => {
			const html = `<script is:build>
											const config = { theme: 'dark' };
										</script>
										<script is:inline pass:data="{ { config } }">
											console.log(config.theme);
										</script>`

			const parsed = parse(html)
			const code = compile(parsed, mockOptions)

			const output = await execute(code)

			// Should create a literal mapping expression inline
			expect(output).toContain('const config = {"theme":"dark"};')
			expect(output).toContain('console.log(config.theme);')
			// Because it is inline, there's no module or json bridge.
		})

		it('should pass data to blocking scripts in head', async () => {
			const html = `<script is:build>
											const config = { theme: 'dark' };
										</script>
										<script is:blocking pass:data="{ { config } }">
											console.log(config.theme);
										</script>`

			const parsed = parse(html)
			const code = compile(parsed, { ...mockOptions, blockingScripts: parsed.blockingScripts })

			const headScripts = new Set<string>()
			await execute(code, { headScripts })
			const out = Array.from(headScripts).join('\n')

			// Blocking scripts are placed in headScripts
			expect(out).toContain('const config = {"theme":"dark"};')
			expect(out).toContain('console.log(config.theme);')
			expect(out).toContain('<script>')
		})

		it('should pass data to style tags as CSS variables', async () => {
			// When using double-brace shorthand `{ { theme } }`, the key is "theme"
			// and the value is the whole object. String(object) = "[object Object]".
			// This documents the intentional behavior — for useful CSS vars,
			// pass the flat object directly: `pass:data="{ theme }"`.
			const html = `<script is:build>
											const theme = { fg: 'white', bg: 'black' };
										</script>
										<style pass:data="{ { theme } }">
											body { color: var(--theme); }
										</style>`

			const parsed = parse(html)
			const code = compile(parsed, mockOptions)

			const styles = new Set<string>()
			await execute(code, { styles })
			const stylesOutput = Array.from(styles).join('\n')

			expect(stylesOutput).toContain(':root {')
			expect(stylesOutput).toContain('--theme: [object Object];')
			expect(stylesOutput).toContain('}')
		})

		it('should pass data object properties to style tags as CSS variables', async () => {
			const html = `<script is:build>
											const theme = { fg: 'white', bg: 'black' };
										</script>
										<style pass:data="{ theme }">
											body { color: var(--fg); background: var(--bg); }
										</style>`

			const parsed = parse(html)
			const code = compile(parsed, mockOptions)

			const styles = new Set<string>()
			await execute(code, { styles })
			const stylesOutput = Array.from(styles).join('\n')

			expect(stylesOutput).toContain(':root {')
			expect(stylesOutput).toContain('--fg: white;')
			expect(stylesOutput).toContain('--bg: black;')
			expect(stylesOutput).toContain('}')
		})

		it('should pass multiple data keys to inline scripts', async () => {
			const html = `<script is:build>
											const apiUrl = '/api/v1';
											const debug = true;
											const version = 3;
										</script>
										<script is:inline pass:data="{ { apiUrl, debug, version } }">
											console.log(apiUrl, debug, version);
										</script>`

			const parsed = parse(html)
			const code = compile(parsed, mockOptions)

			const output = await execute(code)

			expect(output).toContain('const apiUrl = "/api/v1";')
			expect(output).toContain('const debug = true;')
			expect(output).toContain('const version = 3;')
		})

		it('should handle various JSON-serializable value types', async () => {
			const html = `<script is:build>
											const str = 'hello';
											const num = 99;
											const flag = false;
											const list = [1, 2, 3];
											const nothing = null;
										</script>
										<script is:inline pass:data="{ { str, num, flag, list, nothing } }">
											console.log(str, num, flag, list, nothing);
										</script>`

			const parsed = parse(html)
			const code = compile(parsed, mockOptions)

			const output = await execute(code)

			expect(output).toContain('const str = "hello";')
			expect(output).toContain('const num = 99;')
			expect(output).toContain('const flag = false;')
			expect(output).toContain('const list = [1,2,3];')
			expect(output).toContain('const nothing = null;')
		})

		it('should strip pass:data attribute from rendered output when using default client bundling', async () => {
			const html = `<script is:build>
											const val = 'test';
										</script>
										<script pass:data="{ { val } }">
											console.log(val);
										</script>`

			const parsed = parse(html)
			const code = compile(parsed, {
				...mockOptions,
				clientScripts: [{ attrs: '', content: '/virtual.js', passDataExpr: '{ { val } }' }],
			})

			const scripts = new Set<string>()
			await execute(code, { scripts })
			const out = Array.from(scripts).join('\n')

			expect(out).not.toContain('pass:data')
			expect(out).toContain('<script type="module" src="/virtual.js"></script>')
		})

		it('should throw when pass:data value is not brace-wrapped', async () => {
			const html = `<script is:build>
											const config = { theme: 'dark' };
										</script>
										<head>
											<script is:blocking pass:data="config">
												console.log(config);
											</script>
										</head>`

			const parsed = parse(html)
			expect(() =>
				compile(parsed, { ...mockOptions, blockingScripts: parsed.blockingScripts }),
			).toThrow('Directive `pass:data` on <script> must use a braced expression')
		})

		it('should emit JSON data tag before bundled module script', async () => {
			const html = `<script is:build>
				const themeSettings = { colors: { primary: 'blue' } };
			</script>
			<div>App</div>`

			const parsed = parse(html)
			const code = compile(parsed, {
				...mockOptions,
				clientScripts: [
					{ attrs: '', content: '/test.js', passDataExpr: '{ { theme: themeSettings } }' },
				],
			})

			const scripts = new Set<string>()
			const themeSettings = { colors: { primary: 'blue' } }
			await execute(code, { scripts, themeSettings })

			const scriptArr = Array.from(scripts)
			expect(scriptArr.length).toBe(2)
			expect(scriptArr[0]).toContain('<script type="application/json" class="__aero_data">')
			expect(scriptArr[0]).toContain('{"theme":{"colors":{"primary":"blue"}}}')
			expect(scriptArr[1]).toBe('<script type="module" src="/test.js"></script>')
		})
	})
})

// =========================================================================
// extractGetStaticPaths helper
// =========================================================================

describe('extractGetStaticPaths', () => {
	it('should extract a sync function', () => {
		const script = `const x = 1;
export function getStaticPaths() {
	return [{ params: { id: 'a' } }]
}
const y = 2;`

		const { fnText, remaining } = extractGetStaticPaths(script)

		expect(fnText).toContain('export function getStaticPaths()')
		expect(fnText).toContain("return [{ params: { id: 'a' } }]")
		expect(remaining).toContain('const x = 1;')
		expect(remaining).toContain('const y = 2;')
		expect(remaining).not.toContain('getStaticPaths')
	})

	it('should extract an async function', () => {
		const script = `export async function getStaticPaths() {
	const data = await fetch('/api')
	return data
}`

		const { fnText, remaining } = extractGetStaticPaths(script)

		expect(fnText).toContain('export async function getStaticPaths()')
		expect(fnText).toContain('await fetch')
		expect(remaining).toBe('')
	})

	it('should handle nested braces', () => {
		const script = `export function getStaticPaths() {
	const items = [{ a: 1 }, { b: 2 }]
	if (items.length > 0) {
		return items.map(i => ({ params: i }))
	}
	return []
}`

		const { fnText, remaining } = extractGetStaticPaths(script)

		expect(fnText).not.toBeNull()
		expect(fnText).toContain('return []')
		expect(remaining).toBe('')
	})

	it('should return null when no getStaticPaths exists', () => {
		const script = `const x = 1;
const y = 2;`

		const { fnText, remaining } = extractGetStaticPaths(script)

		expect(fnText).toBeNull()
		expect(remaining).toBe(script)
	})
})
