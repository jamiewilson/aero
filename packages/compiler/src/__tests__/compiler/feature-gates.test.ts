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

	it('errors on $effect without is:state', () => {
		const html = `<script is:build>$effect(() => {})</script>`
		expect(() => compile(parse(html), { ...mockOptions, reactivity: true })).toThrow(
			'`$effect` requires `<script is:state>`'
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

	it('emits _method hidden input for static PUT form fallback', () => {
		const html = `<script is:state>
			let id = 1
		</script>
		<form on:submit.prevent="{ PUT('/api/items/1') }"><button type="submit">Delete</button></form>`
		const code = compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		expect(code).toContain('action="/api/items/1"')
		expect(code).toContain('method="post"')
		expect(code).toContain('name="_method" value="PUT"')
	})

	it('allows lifecycle handlers to contain state side effects', () => {
		const html = `<script is:state>
			let saved = false
		</script>
		<button on:click="{ POST('/api/save') }" on:response="{ saved = true }">Save</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		).not.toThrow()
	})

	it('allows non-action lifecycle handlers to use object properties named state', () => {
		const html = `<script is:state>
			let saved = false
			function log(value) {}
		</script>
		<button on:response="{ log({ state: 'saved' }); saved = true }">Save</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		).not.toThrow()
	})

	it('rejects mixed action and state side effects in one handler', () => {
		const html = `<script is:state>
			let saved = false
		</script>
		<button on:click="{ POST('/api/save'); saved = true }">Save</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		).toThrow('Mixed hypermedia action expressions are not allowed')
	})

	it('rejects busy when feature flags are disabled without is:state', () => {
		const html = '<button busy="{ isSaving }">Save</button>'
		expect(() => compile(parse(html), { ...mockOptions, reactivity: false, hypermedia: false })).toThrow(
			'`busy` requires both `reactivity: true` and `hypermedia: true`'
		)
	})

	it('rejects braced runtime-only data-aero attrs without is:state', () => {
		const html = '<span data-aero-text="{ count }">x</span>'
		expect(() => compile(parse(html), { ...mockOptions, reactivity: true })).toThrow(
			'Braced reactive `data-aero-*` attributes require `<script is:state>`'
		)
	})

	it('rejects busy references to missing state bindings', () => {
		const html = `<script is:state>
			let saved = false
		</script>
		<button busy="{ isSaving }" on:click="{ POST('/api/save') }">Save</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		).toThrow('Hypermedia busy signal not found: isSaving')
	})

	it('rejects busy references to non-boolean state bindings', () => {
		const html = `<script is:state>
			let status = 'idle'
		</script>
		<button busy="{ status }" on:click="{ POST('/api/save') }">Save</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		).toThrow('Hypermedia busy signal must be boolean: status')
	})

	it('rejects string state options in action calls', () => {
		const html = `<script is:state>
			let isSaving = false
		</script>
		<button on:click="{ POST('/api/save', { state: 'isSaving' }) }">Save</button>`
		expect(() =>
			compile(parse(html), { ...mockOptions, reactivity: true, hypermedia: true })
		).toThrow('Hypermedia action `state` must reference a boolean state binding')
	})

	it('rejects visible action state references to missing or non-boolean bindings', () => {
		const missing = `<script is:state>
			let saved = false
		</script>
		<button on:click="{ POST('/api/save', { state: isSaving }) }">Save</button>`
		expect(() =>
			compile(parse(missing), { ...mockOptions, reactivity: true, hypermedia: true })
		).toThrow('Hypermedia action state signal not found: isSaving')

		const nonBoolean = `<script is:state>
			let status = 'idle'
		</script>
		<button on:click="{ POST('/api/save', { state: status }) }">Save</button>`
		expect(() =>
			compile(parse(nonBoolean), { ...mockOptions, reactivity: true, hypermedia: true })
		).toThrow('Hypermedia action state signal must be boolean: status')
	})
})
