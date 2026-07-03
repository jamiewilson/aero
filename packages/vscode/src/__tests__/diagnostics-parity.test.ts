import { PARITY_SCENARIOS } from '../../../diagnostics/src/__tests__/fixtures/parity/index.js'
import { describe, expect, it } from 'vitest'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { checkFeatureGates } from '../../../core/src/template-diagnostics/checks/check-feature-gates'
import { checkDirectiveExpressionBraces } from '../../../core/src/template-diagnostics/checks/check-directive-braces'
import type { SourceDocument } from '../../../core/src/template-diagnostics/source-document'

function makeDoc(text: string, fsPath: string): SourceDocument {
	return {
		uri: { fsPath },
		getText: () => text,
		positionAt: (offset: number) => {
			const lines = text.slice(0, offset).split('\n')
			return {
				line: lines.length - 1,
				character: lines[lines.length - 1]?.length ?? 0,
			}
		},
		offsetAt: () => 0,
	}
}

function collectCoreDiagnostics(
	html: string,
	flags: { reactivity: boolean; hypermedia: boolean }
): AeroDiagnostic[] {
	const diagnostics: AeroDiagnostic[] = []
	const doc = makeDoc(html, '/tmp/client/pages/index.html')
	checkFeatureGates(doc, html, diagnostics, flags)
	checkDirectiveExpressionBraces(doc, html, diagnostics)
	return diagnostics
}

describe('diagnostics parity — vscode surface', () => {
	for (const scenario of PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.vscode
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			const diagnostics = collectCoreDiagnostics(scenario.html, scenario.flags)
			if (scenario.id === 'malformed-props-braces') {
				// directive braces check already included
			}

			const match = diagnostics.find(
				d => d.code === expectation.code || d.message.includes(expectation.messageIncludes)
			)
			expect(match).toBeDefined()
			expect(match!.message).toContain(expectation.messageIncludes)
			expect(match!.code).toBe(expectation.code)
		})
	}

	it('reports hypermedia action without hypermedia flag', () => {
		const html = `<script is:state>
	let label = 'Items'
</script>
<button on:click="{ GET('/api/items') }">{ label }</button>`
		const diagnostics = collectCoreDiagnostics(html, { reactivity: true, hypermedia: false })
		expect(diagnostics.some(d => d.message.includes('Hypermedia action calls require'))).toBe(true)
	})
})
