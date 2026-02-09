import { describe, it, expect } from 'vitest'
import { parse } from '@src/compiler/parser'
import { compile } from '@src/compiler/codegen'

// Helper to execute the generated code
async function execute(code: string, context = {}) {
	// Generate the wrapper function
	// We expect the code to be `export default async function(tbd) { ... }`

	// Robust replacement: find the function body
	// We can assume the structure we generate in codegen.ts
	const bodyStart = code.indexOf('{')
	const bodyEnd = code.lastIndexOf('}')
	const body = code.substring(bodyStart + 1, bodyEnd)

	// Create an actual AsyncFunction
	const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
	const renderFn = new AsyncFunction('tbd', body)

	return await renderFn(context)
}

const mockOptions = {
	root: '/' /* What is this?? */,
	resolvePath: (v: string) => v,
}

describe('Codegen', () => {
	it('should compile simple interpolation', async () => {
		const html = `<script on:build>
										title = 'Hello World';
									</script>
									<h1>{ title }</h1>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('<h1>Hello World</h1>')
	})

	it('should compile attribute interpolation', async () => {
		const html = `<script on:build>
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
		const html = `<script on:build>
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

	it('should resolve component tags', async () => {
		const html = `<script on:build>
										const myComp = { name: 'my-comp' };
									</script>
									<my-comp-component />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		// Mock tbd context with renderComponent
		const tbd = {
			renderComponent: async (comp: any, props: any) => {
				return `<div class="mock-rendered">${comp.name}</div>`
			},
		}

		const output = await execute(code, tbd)
		expect(output).toContain('<div class="mock-rendered">my-comp</div>')
		expect(output).not.toContain('<my-comp-component')
	})

	it('should pass props and support shorthand', async () => {
		const html = `<script on:build>
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
		const tbd = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, tbd)

		// First call: { ...someProps, title: "Local", item: 'a' }
		expect(renderedProps[0]).toEqual({ title: 'Local', item: 'a' })
		// Second call (shorthand): { ...props } -> { theme: 'dark' }
		expect(renderedProps[1]).toEqual({ theme: 'dark' })
	})

	it('should support default and named slots', async () => {
		const html = `<script on:build>
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
		const tbd = {
			renderComponent: async (comp: any, props: any, slots: any) => {
				calls.push({ comp, slots })
				return comp.name || ''
			},
		}

		await execute(code, tbd)

		const baseCall = calls.find(c => c.comp.name === 'base')
		expect(baseCall.slots.nav).toContain('nav')
		expect(baseCall.slots.default).toContain('<h1>Main Content</h1>')
	})

	it('should transform static imports to dynamic imports', async () => {
		const html = `<script on:build>
										import { foo } from './fake-module'
										const res = foo;
									</script>
									<div>{ res }</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		expect(code).toContain("const { foo } = await import('./fake-module')")
		expect(code).not.toContain('import { foo } from')
	})

	it('should throw error for script tags without on:client or on:build', async () => {
		const html = `<script>console.log('regular');</script>
									<div>Content</div>`

		const parsed = parse(html)

		expect(() => compile(parsed, mockOptions)).toThrow(
			'Script tags must have on:client or on:build attribute',
		)
	})

	it('should allow external scripts with src attribute', async () => {
		const html = `<script src="https://example.com/script.js"></script>
									<div>Content</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('<script src="https://example.com/script.js"></script>')
	})

	it('should inject clientScriptUrl if provided', async () => {
		const html = '<div>Content</div>'

		const parsed = parse(html)
		const code = compile(parsed, { ...mockOptions, clientScriptUrl: '/test.js' })

		const output = await execute(code)
		expect(output).toContain('<script type="module" src="/test.js"></script>')
	})

	it('should handle attributes with colons (Alpine.js style)', async () => {
		const html = '<button :disabled="!message.length">{ tbd.label }</button>'

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code, { label: 'Click' })
		expect(output).toContain(':disabled="!message.length"')
		expect(output).toContain('Click')
	})

	it('should support default content in slots', async () => {
		const html = `<script on:build>
										const nav = { name: 'nav' };
									</script>
									<slot name="nav">
										<nav-component />
									</slot>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const tbd = {
			slots: {}, // Empty slots at runtime
			renderComponent: async (comp: any) => '<nav-mock />',
		}

		const output = await execute(code, tbd)
		expect(output).toContain('<nav-mock />')
	})

	it('should support inline object literals in data-props', async () => {
		const html = `<script on:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component data-props="{ title: 'Inline Title', count: 42 }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const tbd = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, tbd)
		expect(renderedProps[0]).toEqual({ title: 'Inline Title', count: 42 })
	})

	it('should support expressions in data-props', async () => {
		const html = `<script on:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component data-props="{ title: site.meta.title, doubled: 2 * 21 }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const tbd = {
			site: { meta: { title: 'Test Site' } },
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, tbd)
		expect(renderedProps[0]).toEqual({ title: 'Test Site', doubled: 42 })
	})

	it('should support plain variable name in data-props (auto-spread)', async () => {
		const html = `<script on:build>
										const myComp = { name: 'comp' };
										const myProps = { a: 1, b: 2 };
									</script>
									<my-comp-component data-props="myProps" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const tbd = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, tbd)
		expect(renderedProps[0]).toEqual({ a: 1, b: 2 })
	})

	it('should merge data-props with individual attributes', async () => {
		const html = `<script on:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component 
										data-props="{ base: 'value' }" 
										extra="{ 'additional' }" />`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const renderedProps: any[] = []
		const tbd = {
			renderComponent: async (comp: any, props: any) => {
				renderedProps.push(props)
				return ''
			},
		}

		await execute(code, tbd)
		expect(renderedProps[0]).toEqual({ base: 'value', extra: 'additional' })
	})

	it('should support slot passthrough (receiving and forwarding named slots)', async () => {
		// This tests the scenario: grandparent -> parent -> child
		// where parent receives a slot and passes it through to child
		const html = `<script on:build>
										const parent = { name: 'parent' };
										const child = { name: 'child' };
									</script>
									<parent-component>
										<div slot="nav">Custom Navigation</div>
									</parent-component>`

		const parentTemplate = `<script on:build>
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
		const tbd = {
			renderComponent: async (comp: any, props: any, slots: any) => {
				calls.push({ comp, props, slots })

				// If this is the parent component, execute its template with the received slots
				if (comp.name === 'parent') {
					const bodyStart = parentCode.indexOf('{')
					const bodyEnd = parentCode.lastIndexOf('}')
					const body = parentCode.substring(bodyStart + 1, bodyEnd)
					const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
					const renderFn = new AsyncFunction('tbd', body)
					return await renderFn({ ...tbd, slots })
				}

				// For child, just return slots to verify
				if (comp.name === 'child') {
					return slots.nav || ''
				}

				return ''
			},
		}

		const output = await execute(code, tbd)

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
		const html = `<script on:build>
										const myComp = { name: 'comp' };
									</script>
									<my-comp-component>
										<div slot="side-bar">Side Content</div>
									</my-comp-component>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const calls: any[] = []
		const tbd = {
			renderComponent: async (comp: any, props: any, slots: any) => {
				calls.push({ comp, slots })
				return ''
			},
		}

		await execute(code, tbd)

		expect(calls[0].slots['side-bar']).toContain('Side Content')
	})

	// =========================================================================
	// if/else-if/else conditional chains
	// =========================================================================

	it('should compile simple if/else chain', async () => {
		const html = `<script on:build>
										const showFirst = false;
									</script>
									<div>
										<p if="showFirst">First</p>
										<p else>Fallback</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Fallback')
		expect(output).not.toContain('First')
	})

	it('should compile if/else-if/else chain (else-if matches)', async () => {
		const html = `<script on:build>
										const value = 'B';
									</script>
									<div>
										<p if="value === 'A'">Option A</p>
										<p else-if="value === 'B'">Option B</p>
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
		const html = `<script on:build>
										const value = 'C';
									</script>
									<div>
										<p if="value === 'A'">Option A</p>
										<p else-if="value === 'B'">Option B</p>
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
		const html = `<script on:build>
										const num = 3;
									</script>
									<div>
										<span if="num === 1">One</span>
										<span else-if="num === 2">Two</span>
										<span else-if="num === 3">Three</span>
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
		const html = `<script on:build>
										const showLogo = false;
										const logo = { name: 'logo' };
									</script>
									<div>
										<logo-component if="showLogo" />
										<p else>No logo</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const tbd = {
			renderComponent: async (comp: any) => `<img src="${comp.name}.svg" />`,
		}

		const output = await execute(code, tbd)
		expect(output).toContain('No logo')
		expect(output).not.toContain('<img')
	})

	it('should handle if without else (standalone)', async () => {
		const html = `<script on:build>
										const show = true;
									</script>
									<div>
										<p if="show">Shown</p>
										<p>Always visible</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Shown')
		expect(output).toContain('Always visible')
	})

	it('should support data- prefix for conditionals', async () => {
		const html = `<script on:build>
										const choice = 2;
									</script>
									<div>
										<p data-if="choice === 1">One</p>
										<p data-else-if="choice === 2">Two</p>
										<p data-else>Other</p>
									</div>`

		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('Two')
		expect(output).not.toContain('One')
		expect(output).not.toContain('Other')
	})
})
