import { PARITY_SCENARIOS } from '@aero-js/diagnostics/parity'
import { compile, parse } from '@aero-js/compiler'
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
		})
		return null
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const code = message.includes('aero.config') ? 'AERO_CONFIG' : 'AERO_COMPILE'
		return { code, message }
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
			code: compileDiagnostic(scenario.html, scenario.flags)?.code,
			messageIncludes: scenario.surfaces.compiler?.messageIncludes,
		}))
		expect(snapshot).toMatchInlineSnapshot(`
			[
			  {
			    "code": "AERO_CONFIG",
			    "id": "is-state-without-reactivity",
			    "messageIncludes": "\`<script is:state>\` requires \`reactivity: true\`",
			  },
			  {
			    "code": "AERO_CONFIG",
			    "id": "busy-without-flags",
			    "messageIncludes": "\`busy\` requires both \`reactivity: true\` and \`hypermedia: true\`",
			  },
			  {
			    "code": "AERO_CONFIG",
			    "id": "hypermedia-action-without-hypermedia",
			    "messageIncludes": "Hypermedia action calls require \`hypermedia: true\`",
			  },
			  {
			    "code": "AERO_COMPILE",
			    "id": "malformed-props-braces",
			    "messageIncludes": "Directive \`props\`",
			  },
			  {
			    "code": "AERO_COMPILE",
			    "id": "hypermedia-string-state-option",
			    "messageIncludes": "Hypermedia action \`state\` must reference a boolean state binding",
			  },
			]
		`)
	})
})
