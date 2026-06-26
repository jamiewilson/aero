import { describe, expect, it } from 'vitest'
import { parse } from '../../parser'
import { compile } from '../../codegen'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/client/components/header.html',
}

describe('component markup inside template literal snippets', () => {
	const html = `<script is:state>
	const { count = Aero.bindable() } = Aero.props
</script>
<code>{ \`<header-component bind:count="{ \${count} }" />\` }</code>`

	it('parse preserves snippet text without splitting code content', () => {
		const parsed = parse(html)
		expect(parsed.template).toContain('<header-component bind:count')
		expect(parsed.template).toContain('/>')
		expect(parsed.template).not.toContain('</header-component>')
	})

	it('compile does not treat snippet bind:count as a component bind prop', () => {
		const parsed = parse(html)
		expect(() => compile(parsed, mockOptions)).not.toThrow()
		const code = compile(parsed, mockOptions)
		expect(code).toContain('String( `')
		expect(code).toContain('<header-component')
		expect(code).not.toContain('\uE000')
		expect(code).not.toContain('ReactiveComponentBind')
	})
})
