import { describe, expect, it } from 'vitest'
import { parse } from '../../parser'
import { compile } from '../../codegen'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/client/pages/demos/conditionals.html',
}

describe('conditional comparisons in directive expressions', () => {
	const html = `<script is:state>
	let n = 0
</script>
<p if="{ n > 0 }">Positive</p>
<p else-if="{ n < 0 }">Negative</p>
<p else>Zero</p>`

	it('compiles less-than in else-if without escape corruption', () => {
		const parsed = parse(html)
		expect(() => compile(parsed, mockOptions)).not.toThrow()
		const code = compile(parsed, mockOptions)
		expect(code).toContain('n < 0')
		expect(code).not.toContain('\uE000')
	})
})
