import { describe, expect, it } from 'vitest'
import prettier from 'prettier'
import plugin from '../index.js'

const baseOptions = {
	parser: 'aero',
	plugins: [plugin],
	useTabs: true,
	tabWidth: 2,
	semi: false,
}

describe('prettier-plugin-aero integration', () => {
	it('formats html with standard prettier options and aero transforms', async () => {
		const input = `<section>
  <nav-component></nav-component>
  <p if="{ok}">{title}</p>
</section>`
		const output = await prettier.format(input, {
			...baseOptions,
			aeroAttributePrefix: false,
			aeroBracketSpacing: true,
			aeroSelfClosingComponents: true,
		})
		expect(output).toContain('<nav-component />')
		expect(output).toContain('if="{ ok }"')
		expect(output).toContain('{ title }')
	})

	it('formats script is:build blocks with embedded typescript formatting', async () => {
		const input = `<script is:build lang="ts">
import { getCollection, render } from 'aero:content'
const  foo={bar:1}
</script>`
		const output = await prettier.format(input, {
			...baseOptions,
			semi: false,
			singleQuote: true,
		})
		expect(output).toMatch(/const foo = \{ bar: 1 \}/)
		expect(output).not.toContain(';(getCollection')
	})
})
