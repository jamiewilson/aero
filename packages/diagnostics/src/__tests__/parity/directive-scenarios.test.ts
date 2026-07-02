import {
	DIRECTIVE_PARITY_SCENARIOS,
	PARITY_SCENARIOS,
	ROUTE_PARITY_SCENARIOS,
} from '../../parity'
import { describe, expect, it } from 'vitest'

describe('parity scenarios contract', () => {
	it('defines in-scope compiler/cli/vscode scenarios', () => {
		expect(PARITY_SCENARIOS.length).toBeGreaterThanOrEqual(5)
		for (const scenario of PARITY_SCENARIOS) {
			expect(scenario.id).toBeTruthy()
			expect(scenario.surfaces.compiler ?? scenario.surfaces.vscode).toBeDefined()
		}
	})

	it('defines route parity scenarios', () => {
		expect(ROUTE_PARITY_SCENARIOS.length).toBeGreaterThanOrEqual(1)
	})

	it('defines directive semantics scenarios', () => {
		expect(DIRECTIVE_PARITY_SCENARIOS.length).toBeGreaterThanOrEqual(7)
		for (const scenario of DIRECTIVE_PARITY_SCENARIOS) {
			expect(scenario.id).toBeTruthy()
			expect(scenario.html).toBeTruthy()
			expect(
				scenario.surfaces.compiler ??
					scenario.surfaces.vscode ??
					scenario.prettier
			).toBeDefined()
		}
	})
})
