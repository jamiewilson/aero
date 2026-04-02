/**
 * Golden snapshots for compile output — catch unintended codegen drift (Phase A regression suite).
 */

import { describe, it, expect } from 'vitest'
import { compileTemplate } from '../../codegen'

const opts = {
	root: '/project',
	resolvePath: (s: string) => s,
	importer: '/project/pages/test.html',
}

describe('compileTemplate snapshots', () => {
	it('minimal page with build script and interpolation', () => {
		const src = `<script is:build>
const title = 'Hi'
</script>
<h1>{ title }</h1>`
		expect(
			compileTemplate(src, {
				...opts,
				diagnosticTemplateSource: src,
			})
		).toMatchSnapshot()
	})

	it('component props and static attribute with special characters', () => {
		const src = `<script is:build>
const x = 1
</script>
<my-component title="a&quot;b" data-x="{ x }" />`
		expect(
			compileTemplate(src, {
				...opts,
				diagnosticTemplateSource: src,
			})
		).toMatchSnapshot()
	})
})
