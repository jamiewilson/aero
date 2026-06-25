import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('quoted interpolation in code text', () => {
	it('emits reactive text bind for bind:count snippet inside code element', () => {
		const html = `<script is:state>
	let count = Aero.bindable(0)
</script>
<span>via <code>bind:count="{ count }"</code></span>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('data-aero-text=')
		expect(code).toContain('escapeHtml( count )')
		expect(code).not.toContain('bind:count=&quot;{ count }&quot;')
	})
})
