import { describe, expect, it } from 'vitest'
import { escapeHtml, escapeScriptJson, raw, trim, trimStart, trimEnd } from '../../helpers'
import { compile } from '../../codegen'
import { parse } from '../../parser'
import { formatAttributeBind as formatAttributeBindValue } from '../../../../reactivity/src/bindings/coerce-attribute-value'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

async function executeRender(code: string, state: Record<string, unknown> = {}) {
	const defaultIdx = code.indexOf('export default async function')
	const mountIdx = code.indexOf('export function mountStateBindings')
	const renderCode =
		defaultIdx >= 0
			? mountIdx >= 0
				? code.slice(defaultIdx, mountIdx)
				: code.slice(defaultIdx)
			: code
	const bodyStart = renderCode.indexOf('{')
	const bodyEnd = renderCode.lastIndexOf('}')
	const body = renderCode.substring(bodyStart + 1, bodyEnd)
	const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
	const renderFn = new AsyncFunction('Aero', body)
	const aeroContext = {
		scripts: new Set<string>(),
		headScripts: new Set<string>(),
		styles: new Set<string>(),
		nextPassDataId: () => '__aero_0',
		renderComponent: async () => '',
		escapeHtml,
		escapeScriptJson,
		formatAttributeBind: (name: string, value: unknown) =>
			formatAttributeBindValue(name, value, escapeHtml),
		raw,
		trim,
		trimStart,
		trimEnd,
		...state,
	}
	return await renderFn(aeroContext)
}

describe('reactive attribute bindings', () => {
	it('emits formatAttributeBind for data-theme instead of property marker', () => {
		const html = `<script is:state>
			let theme = 'system'
		</script>
		<html data-theme="{ theme }"></html>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('formatAttributeBind("data-theme", theme)')
		expect(code).toContain('data-aero-bind="0"')
		expect(code).not.toContain('data-aero-property-data-theme')
		expect(code).toContain('attributeBinds:')
	})

	it('emits formatAttributeBind for href with data-aero-bind', () => {
		const html = `<script is:state>
			let path = '/dashboard'
		</script>
		<a href="{ path }">Go</a>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('formatAttributeBind("href", path)')
		expect(code).toContain('data-aero-bind="0"')
		expect(code).not.toContain('data-aero-property-href')
	})

	it('emits formatAttributeBind for aria-expanded with data-aero-bind', () => {
		const html = `<script is:state>
			let open = false
		</script>
		<button aria-expanded="{ open }">Menu</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('formatAttributeBind("aria-expanded", open)')
		expect(code).toContain('data-aero-bind="0"')
	})

	it('groups multiple formatAttributeBind calls under one data-aero-bind marker', () => {
		const html = `<script is:state>
			let url = '/a.jpg'
			let caption = 'Photo'
			let width = 800
		</script>
		<img src="{ url }" alt="{ caption }" width="{ width }" />`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('formatAttributeBind("src", url)')
		expect(code).toContain('formatAttributeBind("alt", caption)')
		expect(code).toContain('formatAttributeBind("width", width)')
		expect(code.match(/data-aero-bind="/g)?.length).toBe(1)
	})

	it('keeps disabled on property bind path with SSR presence', () => {
		const html = `<script is:state>
			let saving = false
		</script>
		<button disabled="{ saving }">Save</button>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-property-disabled="0"')
		expect(code).not.toContain('data-aero-bind')
		expect(code).toContain('propertyBinds:')
	})

	it('keeps input value on model bind path', () => {
		const html = `<script is:state>
			let email = ''
		</script>
		<input value="{ email }" />`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('data-aero-model-value="0"')
		expect(code).not.toContain('data-aero-bind')
	})

	it('does not emit bind markers without is:state', () => {
		const html = `<script is:build>
			let path = '/x'
		</script>
		<a href="{ path }">Go</a>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('href="${ path }"')
		expect(code).not.toContain('data-aero-bind')
		expect(code).not.toContain('formatAttributeBind("')
	})
})

describe('reactive attribute bindings SSR', () => {
	it('omits is-even at SSR when expression is false', async () => {
		const html = `<script is:state>
			let count = 1
		</script>
		<h2 is-even="{ count % 2 === 0 }">{ count }</h2>`

		const code = compile(parse(html), mockOptions)
		const out = await executeRender(code)
		expect(out).not.toMatch(/\bis-even=/)
		expect(out).toContain('>1<')
	})

	it('includes is-even at SSR when expression is true', async () => {
		const html = `<script is:state>
			let count = 2
		</script>
		<h2 is-even="{ count % 2 === 0 }">{ count }</h2>`

		const code = compile(parse(html), mockOptions)
		const out = await executeRender(code)
		expect(out).toMatch(/\bis-even=""/)
		expect(out).toContain('>2<')
	})

	it('SSR aria-expanded false emits aria-expanded="false" not omission', async () => {
		const html = `<script is:state>
			let open = false
		</script>
		<button aria-expanded="{ open }">Menu</button>`

		const code = compile(parse(html), mockOptions)
		const out = await executeRender(code)
		expect(out).toContain('aria-expanded="false"')
	})

	it('SSR data-theme emits string value', async () => {
		const html = `<script is:state>
			let theme = 'dark'
		</script>
		<html data-theme="{ theme }"></html>`

		const code = compile(parse(html), mockOptions)
		const out = await executeRender(code)
		expect(out).toContain('data-theme="dark"')
	})
})
