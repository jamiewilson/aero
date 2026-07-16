import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'
import { CompileError } from '../../types'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/test.html',
}

describe('undeclared reactive scope names', () => {
	it('errors when on:click calls a missing is:state binding', () => {
		const html = `<script is:state>
	let items = []
	const remove = () => { items = items.slice(1) }
</script>
<button on:click="{ add() }">Add</button>
<button on:click="{ remove() }">Remove</button>`

		expect(() =>
			compile(parse(html), { ...mockOptions, diagnosticTemplateSource: html })
		).toThrow(/Unknown name `add`/)
	})

	it('reports CompileError location for the missing name', () => {
		const html = `<script is:state>
	let items = []
</script>
<button on:click="{ add() }">Add</button>`
		let error: unknown
		try {
			compile(parse(html), { ...mockOptions, diagnosticTemplateSource: html })
		} catch (err) {
			error = err
		}
		expect(error).toBeInstanceOf(CompileError)
		expect((error as CompileError).message).toContain('`add`')
		expect((error as CompileError).line).toBeGreaterThan(0)
	})

	it('allows declared handlers and Math globals', () => {
		const html = `<script is:state>
	let items = [1]
	const shuffle = () => { items = [...items].sort(() => Math.random() - 0.5) }
</script>
<button on:click="{ shuffle() }">Shuffle</button>`

		expect(() =>
			compile(parse(html), { ...mockOptions, diagnosticTemplateSource: html })
		).not.toThrow()
	})

	it('allows hypermedia GET in on:* handlers', () => {
		const html = `<script is:state>
	let n = 0
</script>
<button on:click="{ GET('/api/x') }">Go</button>`

		expect(() =>
			compile(parse(html), {
				...mockOptions,
				diagnosticTemplateSource: html,
				hypermedia: true,
			})
		).not.toThrow()
	})

	it('allows for-loop binding names in key and body text', () => {
		const html = `<script is:state>
	let items = [{ id: 'a' }]
</script>
<li for="{ const { id } of items }" key="{ id }"><code>{ id }</code></li>`

		expect(() =>
			compile(parse(html), { ...mockOptions, diagnosticTemplateSource: html })
		).not.toThrow()
	})

	it('errors on missing name in reactive text', () => {
		const html = `<script is:state>
	let count = 0
</script>
<p>{ missing }</p>`

		expect(() =>
			compile(parse(html), { ...mockOptions, diagnosticTemplateSource: html })
		).toThrow(/Unknown name `missing`/)
	})
})
