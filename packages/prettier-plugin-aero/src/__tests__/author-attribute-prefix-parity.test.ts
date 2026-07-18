import { AUTHOR_ATTRIBUTE_PREFIX_SCENARIOS } from '../../../diagnostics/src/__tests__/fixtures/parity/index.js'
import { describe, expect, it } from 'vitest'
import prettier from 'prettier'
import plugin from '../index.js'

const baseOptions = {
	parser: 'aero',
	plugins: [plugin],
	useTabs: true,
	tabWidth: 2,
	semi: false,
	aeroBracketSpacing: true,
	aeroSelfClosingComponents: true,
}

describe('author attribute prefix parity — prettier', () => {
	for (const scenario of AUTHOR_ATTRIBUTE_PREFIX_SCENARIOS) {
		it(`${scenario.id}: ${scenario.description}`, async () => {
			const output = await prettier.format(scenario.html, {
				...baseOptions,
				aeroAttributePrefix: scenario.prettier.aeroAttributePrefix,
			})
			for (const fragment of scenario.prettier.mustContain) {
				expect(output).toContain(fragment)
			}
			for (const fragment of scenario.prettier.mustNotContain ?? []) {
				expect(output).not.toContain(fragment)
			}
		})
	}
})
