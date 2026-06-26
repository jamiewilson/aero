import { describe, expect, it } from 'vitest'
import {
	escapeInterpolationBodyMarkup,
	restoreInterpolationBodyMarkup,
} from '../index'

describe('escapeInterpolationBodyMarkup', () => {
	it('escapes < only inside Aero expression bodies', () => {
		const text = '<code>{ `<header-component />` }</code><a for="{ const x of xs }" href="{ path }">'
		const { text: escaped, restore } = escapeInterpolationBodyMarkup(text)
		expect(escaped).not.toContain('<header-component')
		expect(escaped).toContain('\uE000header-component')
		expect(escaped).toContain('/>')
		expect(escaped).toContain('for="{ const x of xs }"')
		expect(restore(escaped)).toBe(text)
		expect(restoreInterpolationBodyMarkup(escaped)).toBe(text)
	})

	it('does not escape arrow functions inside script bodies', () => {
		const text = `<script is:build>
export function getStaticPaths() {
	return docs.map(doc => ({ slug: doc.id }))
}
</script>
<code>{ \`<x-component />\` }</code>`
		const { text: escaped, restore } = escapeInterpolationBodyMarkup(text)
		expect(escaped).toContain('doc => ({')
		expect(restore(escaped)).toBe(text)
	})

	it('does not escape comparison operators in directive attribute expressions', () => {
		const text = '<p if="{ n > 0 }">x</p><p else-if="{ n < 0 }">y</p>'
		const { text: escaped, restore } = escapeInterpolationBodyMarkup(text)
		expect(escaped).toContain('n > 0')
		expect(escaped).toContain('n < 0')
		expect(escaped).not.toContain('\uE000')
		expect(restore(escaped)).toBe(text)
	})
})
