import { describe, expect, it } from 'vitest'
import {
	locateInEmbeddedScript,
	locateInTemplateSource,
	lineColumnAtOffset,
} from '../../helpers'

describe('locateInTemplateSource', () => {
	it('resolves offset to 1-based line / 0-based column', () => {
		const source = 'a\nbc\ndef'
		expect(locateInTemplateSource(source, { offset: 0 })).toEqual({ line: 1, column: 0 })
		expect(locateInTemplateSource(source, { offset: 2 })).toEqual({ line: 2, column: 0 })
		expect(locateInTemplateSource(source, { offset: 6 })).toEqual({ line: 3, column: 1 })
		expect(lineColumnAtOffset(source, 6)).toEqual({ line: 3, column: 1 })
	})

	it('finds the first matching needle', () => {
		const source = '<div switch="{ x }"><span case="a"></span></div>'
		expect(locateInTemplateSource(source, { needles: ['case=', 'switch='] })).toEqual(
			locateInTemplateSource(source, { offset: source.indexOf('case=') })
		)
	})

	it('prefers markup over script bodies when maskEmbedded is set', () => {
		const source = `<script is:state>
	let isActive = false
</script>
<div class:is-active="{ isActive }"></div>
`
		const loc = locateInTemplateSource(source, {
			needles: ['isActive'],
			maskEmbedded: true,
		})
		expect(loc?.line).toBe(4)
		expect(source.split('\n')[3]).toContain('class:is-active')
	})

	it('maps embedded script offsets into the full template', () => {
		const script = '\n\tlet count = 0\n'
		const template = `<script is:state>${script}</script>\n<div></div>\n`
		const countOffset = script.indexOf('count')
		const loc = locateInEmbeddedScript(template, script, countOffset)
		expect(loc?.line).toBe(2)
		expect(template.split('\n')[1]).toContain('count')
	})
})
