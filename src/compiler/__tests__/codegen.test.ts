import { describe, it, expect } from 'vitest'
import { parse } from '../parser'
import { compile } from '../codegen'

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
	root: '/Users/jamie/dev/tbd',
	resolvePath: (v: string) => v,
}

describe('Codegen', () => {
	it('should compile simple interpolation', async () => {
		const html = `
            <script on:build>
                title = 'Hello World';
            </script>
            <h1>{ title }</h1>
        `
		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('<h1>Hello World</h1>')
	})

	it('should compile attribute interpolation', async () => {
		const html = `
            <script on:build>
                const cls = 'active';
            </script>
            <div class="{ cls }"></div>
        `
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

	it('should compile data-for loops', async () => {
		const html = `
            <script on:build>
                const items = ['a', 'b'];
            </script>
            <ul>
                <li data-for="{ item in items }">{ item }</li>
            </ul>
        `
		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		// Normalize whitespace for easier comparison if needed, but contain should work
		expect(output).toContain('<li>a</li>')
		expect(output).toContain('<li>b</li>')
		expect(output).not.toContain('data-for')
	})

	it('should resolve component tags', async () => {
		const html = `
            <script on:build>
                const myComp = { name: 'my-comp' };
            </script>
            <my-comp-component />
        `
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
		const html = `
            <script on:build>
                const myComp = { name: 'comp' };
                const someProps = { title: 'External' };
                const props = { theme: 'dark' };
            </script>
            <my-comp-component title="Local" item="{ 'a' }" data-props="{ ...someProps }" />
            <my-comp-component data-props />
        `
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
		const html = `
            <script on:build>
                const base = { name: 'base' };
                const nav = { name: 'nav' };
            </script>
            <base-layout>
                <nav-component slot="nav" />
                <h1>Main Content</h1>
            </base-layout>
        `
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
		const html = `
            <script on:build>
                import { foo } from './fake-module'
                const res = foo;
            </script>
            <div>{ res }</div>
        `
		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		expect(code).toContain("const { foo } = await import('./fake-module')")
		expect(code).not.toContain('import { foo } from')
	})

	it('should preserve plain script tags and mark them as type="module"', async () => {
		const html = `
            <script>console.log('regular');</script>
            <div>Content</div>
        `
		const parsed = parse(html)
		const code = compile(parsed, mockOptions)

		const output = await execute(code)
		expect(output).toContain('<script type="module">console.log(\'regular\');</script>')
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
		const html = `
            <script on:build>
                const nav = { name: 'nav' };
            </script>
            <slot name="nav">
                <nav-component />
            </slot>
        `
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
		const html = `
            <script on:build>
                const myComp = { name: 'comp' };
            </script>
            <my-comp-component data-props="{ title: 'Inline Title', count: 42 }" />
        `
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
		const html = `
            <script on:build>
                const myComp = { name: 'comp' };
            </script>
            <my-comp-component data-props="{ title: site.meta.title, doubled: 2 * 21 }" />
        `
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
		const html = `
            <script on:build>
                const myComp = { name: 'comp' };
                const myProps = { a: 1, b: 2 };
            </script>
            <my-comp-component data-props="myProps" />
        `
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
		const html = `
            <script on:build>
                const myComp = { name: 'comp' };
            </script>
            <my-comp-component data-props="{ base: 'value' }" extra="{ 'additional' }" />
        `
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
})
