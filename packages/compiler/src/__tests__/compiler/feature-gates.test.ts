import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/test.html',
}

describe('feature gates', () => {
	it('errors on is:state when reactivity is disabled', () => {
		const html = `<script is:state>let x = 1</script><p>{ x }</p>`
		expect(() => compile(parse(html), { ...mockOptions, reactivity: false })).toThrow(
			'reactivity: true'
		)
	})

	it('errors on action calls when hypermedia is disabled', () => {
		const html = `<script is:state>
			function save() { POST('/api/save') }
		</script>
		<button on:click="{ save() }">Save</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: false })
		).toThrow('hypermedia: true')
	})

	it('errors on direct action in handler when hypermedia is disabled', () => {
		const html = `<script is:state>
			let label = 'Items'
		</script>
		<button on:click="{ GET('/api/items') }">{ label }</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: false })
		).toThrow('hypermedia: true')
	})

	it('emits native href fallback for static GET on anchor', () => {
		const html = `<script is:state>
			let label = 'Items'
		</script>
		<a on:click="{ GET('/api/items') }">{ label }</a>`
		const code = compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		expect(code).toContain('href="/api/items"')
	})
})
