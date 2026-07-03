import {
	DIRECTIVE_PARITY_BUILD_PREAMBLE,
	DIRECTIVE_PARITY_SCENARIOS,
} from '../../../../diagnostics/src/__tests__/fixtures/parity/index.js'
import { compile, parse } from '@aero-js/compiler'
import { describe, expect, it } from 'vitest'

const mockOptions = {
	root: '/',
	resolvePath: (v: string) => v,
	importer: '/test.html',
}

function compileDirectiveScenario(html: string): { ok: true } | { ok: false; message: string } {
	try {
		compile(parse(DIRECTIVE_PARITY_BUILD_PREAMBLE + html), mockOptions)
		return { ok: true }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		return { ok: false, message }
	}
}

describe('directive parity — compiler surface', () => {
	for (const scenario of DIRECTIVE_PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.compiler
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			const result = compileDirectiveScenario(scenario.html)
			if (expectation.outcome === 'pass') {
				expect(result.ok, result.ok ? '' : result.message).toBe(true)
				return
			}
			expect(result.ok).toBe(false)
			if (!result.ok && expectation.messageIncludes) {
				expect(result.message).toContain(expectation.messageIncludes)
			}
		})
	}
})

describe('directive parity — compiler snapshot', () => {
	it('matches committed compiler directive parity baseline', () => {
		const snapshot = DIRECTIVE_PARITY_SCENARIOS.filter(s => s.surfaces.compiler).map(
			scenario => ({
				id: scenario.id,
				outcome: scenario.surfaces.compiler!.outcome,
				messageIncludes: scenario.surfaces.compiler!.messageIncludes,
				ok: compileDirectiveScenario(scenario.html).ok,
			})
		)
		expect(snapshot).toMatchInlineSnapshot(`
			[
			  {
			    "id": "native-for-on-label",
			    "messageIncludes": undefined,
			    "ok": true,
			    "outcome": "pass",
			  },
			  {
			    "id": "native-for-on-output",
			    "messageIncludes": undefined,
			    "ok": true,
			    "outcome": "pass",
			  },
			  {
			    "id": "native-switch-on-input",
			    "messageIncludes": undefined,
			    "ok": true,
			    "outcome": "pass",
			  },
			  {
			    "id": "native-default-on-track",
			    "messageIncludes": undefined,
			    "ok": true,
			    "outcome": "pass",
			  },
			  {
			    "id": "forgotten-brace-for-on-li",
			    "messageIncludes": "Directive \`for\` on <li> must use a braced expression",
			    "ok": false,
			    "outcome": "fail",
			  },
			  {
			    "id": "prefixed-for-on-label",
			    "messageIncludes": "Directive \`aero-for\` on <label> must use a braced expression",
			    "ok": false,
			    "outcome": "fail",
			  },
			  {
			    "id": "braced-for-on-label",
			    "messageIncludes": "for directive must be valid JavaScript",
			    "ok": false,
			    "outcome": "fail",
			  },
			]
		`)
	})
})
