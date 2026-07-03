import { DIRECTIVE_PARITY_SCENARIOS } from '../../../diagnostics/src/__tests__/fixtures/parity/index.js'
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
	aeroSelfClosingComponents: false,
}

describe('directive parity — prettier surface', () => {
	for (const scenario of DIRECTIVE_PARITY_SCENARIOS) {
		if (!scenario.prettier) continue

		it(`${scenario.id}: ${scenario.description}`, async () => {
			const output = await prettier.format(scenario.html, {
				...baseOptions,
				aeroAttributePrefix: scenario.prettier.aeroAttributePrefix,
			})
			for (const fragment of scenario.prettier.mustContain ?? []) {
				expect(output).toContain(fragment)
			}
			for (const fragment of scenario.prettier.mustNotContain ?? []) {
				expect(output).not.toContain(fragment)
			}
		})
	}
})
