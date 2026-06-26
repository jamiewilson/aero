import { describe, expect, it } from 'vitest'
import { prepareAeroTemplateSource } from '../template-prep'

describe('prepareAeroTemplateSource', () => {
	it('escapes markup inside interpolation bodies for htmlSafeText', () => {
		const text = '<code>{ `<header-component />` }</code>'
		const prep = prepareAeroTemplateSource(text)
		expect(prep.htmlSafeText).not.toContain('<header-component')
		expect(prep.htmlSafeText).toContain('\uE000header-component')
		expect(prep.restore(prep.htmlSafeText)).toBe(text)
	})

	it('does not escape comparison operators in directive expressions', () => {
		const text = '<p if="{ n > 0 }">x</p><p else-if="{ n < 0 }">y</p>'
		const prep = prepareAeroTemplateSource(text)
		expect(prep.htmlSafeText).toContain('n < 0')
		expect(prep.htmlSafeText).not.toContain('\uE000')
	})

	it('collects ignore zones for comments, script/style, and interpolations', () => {
		const text = `<!-- <foo-component /> -->
<script is:build>const x = 1</script>
<p>{ count }</p>`
		const prep = prepareAeroTemplateSource(text)
		expect(prep.ignoreZones.length).toBeGreaterThanOrEqual(3)
		expect(prep.interpolationSpans.some(z => text.slice(z.start, z.end).includes('count'))).toBe(
			true
		)
	})
})
