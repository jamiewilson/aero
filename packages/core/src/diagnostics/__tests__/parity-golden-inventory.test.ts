/**
 * Golden inventory: known source-level compile failures that must stay on the parity matrix.
 *
 * Prevents “matrix all green” while compile-only holes (no IDE twin) sneak back in.
 * Lives in core (depends on `@aero-js/compiler`); matrix fixtures live in diagnostics.
 */

import { compile, parse } from '@aero-js/compiler'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PARITY_SCENARIOS } from '../../../../diagnostics/src/__tests__/fixtures/parity/scenarios'

interface MatrixRule {
	readonly ruleId: string
	readonly surfaces: readonly string[]
	readonly intentionalAsymmetry: boolean
	readonly scenarioIds: readonly string[]
}

interface MatrixFile {
	readonly rules: readonly MatrixRule[]
}

interface GoldenFixture {
	readonly id: string
	readonly ruleId: string
	readonly html: string
	readonly flags: { readonly reactivity: boolean; readonly hypermedia: boolean }
	readonly messageIncludes: string
}

/**
 * Seed inventory of source-alone AERO_COMPILE rules that previously drifted (compile vs IDE).
 * Add a row here when landing a new shared source-level diagnostic.
 */
const GOLDEN_SOURCE_LEVEL_COMPILE_FIXTURES: readonly GoldenFixture[] = [
	{
		id: 'class-non-braced',
		ruleId: 'directive-braces.runtime-class',
		html: `<script is:state>
	let count = 0
</script>
<div class:is-active="true"></div>`,
		flags: { reactivity: true, hypermedia: false },
		messageIncludes: 'must use a braced expression',
	},
	{
		id: 'class-empty-quoted',
		ruleId: 'directive-braces.runtime-class',
		html: `<script is:state>
	let isActive = false
</script>
<div class:is-active=""></div>`,
		flags: { reactivity: true, hypermedia: false },
		messageIncludes: 'must use a braced expression',
	},
	{
		id: 'show-non-braced',
		ruleId: 'directive-braces.show',
		html: `<script is:state>
	let open = false
</script>
<div show="open"></div>`,
		flags: { reactivity: true, hypermedia: false },
		messageIncludes: 'must use a braced expression',
	},
	{
		id: 'html-non-braced',
		ruleId: 'directive-braces.html',
		html: `<script is:state>
	let markup = 'x'
</script>
<div html="markup"></div>`,
		flags: { reactivity: true, hypermedia: false },
		messageIncludes: 'must use a braced expression',
	},
	{
		id: 'props-non-braced',
		ruleId: 'directive-braces.props',
		html: '<div props="not-braced">x</div>',
		flags: { reactivity: false, hypermedia: false },
		messageIncludes: 'Directive `props`',
	},
]

const matrixPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../../diagnostics/src/__tests__/fixtures/parity/matrix.json'
)

const mockOptions = {
	root: '/',
	resolvePath: (v: string) => v,
	importer: '/tmp/client/pages/index.html',
}

describe('parity golden inventory', () => {
	const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as MatrixFile
	const ruleById = new Map(matrix.rules.map(r => [r.ruleId, r]))
	const scenarioById = new Map(PARITY_SCENARIOS.map(s => [s.id, s]))

	for (const fixture of GOLDEN_SOURCE_LEVEL_COMPILE_FIXTURES) {
		it(`${fixture.id}: compile still fails with expected message`, () => {
			expect(() =>
				compile(parse(fixture.html), {
					...mockOptions,
					reactivity: fixture.flags.reactivity,
					hypermedia: fixture.flags.hypermedia,
					diagnosticTemplateSource: fixture.html,
				})
			).toThrow(new RegExp(fixture.messageIncludes.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
		})

		it(`${fixture.id}: matrix row is both-surface (or intentional) with scenarios`, () => {
			const rule = ruleById.get(fixture.ruleId)
			expect(rule, `missing matrix row ${fixture.ruleId}`).toBeDefined()
			if (!rule) return
			if (rule.intentionalAsymmetry) return
			expect(rule.surfaces).toContain('compile')
			expect(rule.surfaces).toContain('ide')
			expect(rule.scenarioIds.length).toBeGreaterThan(0)
			for (const id of rule.scenarioIds) {
				const scenario = scenarioById.get(id)
				expect(scenario, `missing scenario ${id}`).toBeDefined()
				expect(scenario!.surfaces.compiler).toBeDefined()
				expect(scenario!.surfaces.ide ?? scenario!.surfaces.vscode).toBeDefined()
			}
		})
	}
})
