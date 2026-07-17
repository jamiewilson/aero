import { PARITY_SCENARIOS } from '../../../../diagnostics/src/__tests__/fixtures/parity/index.js'
import { compile, parse } from '@aero-js/compiler'
import { normalizeToDiagnostics } from '@aero-js/diagnostics'
import { describe, expect, it } from 'vitest'

const mockOptions = {
	root: '/',
	resolvePath: (v: string) => v,
	importer: '/test.html',
}

function compileDiagnostic(
	html: string,
	flags: { reactivity: boolean; hypermedia: boolean }
): { code: string; message: string } | null {
	try {
		compile(parse(html), {
			...mockOptions,
			reactivity: flags.reactivity,
			hypermedia: flags.hypermedia,
			diagnosticTemplateSource: html,
		})
		return null
	} catch (error) {
		const diagnostic = normalizeToDiagnostics(error)[0]
		if (!diagnostic) return null
		return { code: diagnostic.code, message: diagnostic.message }
	}
}

describe('diagnostics parity — compiler surface', () => {
	for (const scenario of PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.compiler
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			const result = compileDiagnostic(scenario.html, scenario.flags)
			expect(result).not.toBeNull()
			expect(result!.code).toBe(expectation.code)
			expect(result!.message).toContain(expectation.messageIncludes)
		})
	}
})

describe('diagnostics parity — snapshot baseline', () => {
	it('matches committed compiler parity snapshot', () => {
		const snapshot = PARITY_SCENARIOS.filter(s => s.surfaces.compiler).map(scenario => ({
			id: scenario.id,
			ruleId: scenario.ruleId,
			category: scenario.category,
			code: compileDiagnostic(scenario.html, scenario.flags)?.code,
			messageIncludes: scenario.surfaces.compiler?.messageIncludes,
		}))
		expect(snapshot).toMatchInlineSnapshot(`
			[
			  {
			    "category": "feature-gates",
			    "code": "AERO_CONFIG",
			    "id": "is-state-without-reactivity",
			    "messageIncludes": "\`<script is:state>\` requires \`reactivity: true\`",
			    "ruleId": "feature-gate.is-state-requires-reactivity",
			  },
			  {
			    "category": "feature-gates",
			    "code": "AERO_CONFIG",
			    "id": "busy-without-flags",
			    "messageIncludes": "\`busy\` requires both \`reactivity: true\` and \`hypermedia: true\`",
			    "ruleId": "feature-gate.busy-requires-flags",
			  },
			  {
			    "category": "feature-gates",
			    "code": "AERO_CONFIG",
			    "id": "hypermedia-action-without-hypermedia",
			    "messageIncludes": "Hypermedia action calls require \`hypermedia: true\`",
			    "ruleId": "feature-gate.action-requires-hypermedia",
			  },
			  {
			    "category": "directive-braces",
			    "code": "AERO_COMPILE",
			    "id": "malformed-props-braces",
			    "messageIncludes": "Directive \`props\`",
			    "ruleId": "directive-braces.props",
			  },
			  {
			    "category": "hypermedia",
			    "code": "AERO_CONFIG",
			    "id": "hypermedia-string-state-option",
			    "messageIncludes": "Hypermedia action \`state\` must reference a boolean state binding",
			    "ruleId": "hypermedia.action-state-must-be-binding",
			  },
			  {
			    "category": "reactive-scope",
			    "code": "AERO_COMPILE",
			    "id": "reactive-class-undeclared-state",
			    "messageIncludes": "Reactive class binding \`class:is-active\` must reference a declared state variable",
			    "ruleId": "reactive-scope.class-binding-state-ref",
			  },
			  {
			    "category": "reactive-scope",
			    "code": "AERO_COMPILE",
			    "id": "reactive-event-unknown-name",
			    "messageIncludes": "Unknown name \`add\`",
			    "ruleId": "reactive-scope.unknown-name-in-handler",
			  },
			  {
			    "category": "structural",
			    "code": "AERO_COMPILE",
			    "id": "switch-orphan-child",
			    "messageIncludes": "case\` / \`default\`",
			    "ruleId": "structural.switch-direct-children",
			  },
			]
		`)
	})
})
