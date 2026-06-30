import { PARITY_SCENARIOS, ROUTE_PARITY_SCENARIOS } from '../../parity/scenarios'
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
})
