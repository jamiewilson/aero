/**
 * CI gate: parity matrix rows and scenarios stay in sync.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PARITY_SCENARIOS } from '../fixtures/parity/scenarios'

interface MatrixRule {
	readonly ruleId: string
	readonly surfaces: readonly string[]
	readonly intentionalAsymmetry: boolean
	readonly scenarioIds: readonly string[]
}

interface MatrixFile {
	readonly rules: readonly MatrixRule[]
}

const matrixPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../fixtures/parity/matrix.json'
)

describe('parity matrix sync', () => {
	const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as MatrixFile
	const scenarioById = new Map(PARITY_SCENARIOS.map(s => [s.id, s]))
	const scenarioRuleIds = new Set(PARITY_SCENARIOS.map(s => s.ruleId))

	it('every scenario ruleId exists in the matrix', () => {
		const matrixIds = new Set(matrix.rules.map(r => r.ruleId))
		for (const ruleId of scenarioRuleIds) {
			expect(matrixIds.has(ruleId), `missing matrix row for scenario ruleId ${ruleId}`).toBe(
				true
			)
		}
	})

	it('both-surfaces (non-intentional) rows have at least one scenario', () => {
		for (const rule of matrix.rules) {
			if (rule.intentionalAsymmetry) continue
			const hasCompile = rule.surfaces.includes('compile')
			const hasIde = rule.surfaces.includes('ide')
			if (!(hasCompile && hasIde)) continue
			expect(
				rule.scenarioIds.length,
				`rule ${rule.ruleId} requires both surfaces but has no scenarios`
			).toBeGreaterThan(0)
			for (const id of rule.scenarioIds) {
				expect(scenarioById.has(id), `matrix scenarioId ${id} missing from PARITY_SCENARIOS`).toBe(
					true
				)
			}
		}
	})

	it('scenario surface keys align with matrix surfaces for linked rows', () => {
		for (const rule of matrix.rules) {
			for (const id of rule.scenarioIds) {
				const scenario = scenarioById.get(id)
				expect(scenario).toBeDefined()
				if (!scenario || rule.intentionalAsymmetry) continue
				if (rule.surfaces.includes('compile')) {
					expect(scenario.surfaces.compiler, `${id} missing compiler expectation`).toBeDefined()
				}
				if (rule.surfaces.includes('ide')) {
					expect(
						scenario.surfaces.ide ?? scenario.surfaces.vscode,
						`${id} missing ide expectation`
					).toBeDefined()
				}
			}
		}
	})
})
