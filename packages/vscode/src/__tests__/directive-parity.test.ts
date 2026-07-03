import { DIRECTIVE_PARITY_SCENARIOS } from '@aero-js/diagnostics/parity'
import { describe, expect, it } from 'vitest'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { checkDirectiveExpressionBraces } from '../../../core/src/template-diagnostics/checks/check-directive-braces'
import type { SourceDocument } from '../../../core/src/template-diagnostics/source-document'

function makeDoc(text: string): SourceDocument {
	return {
		uri: { fsPath: '/test.html' },
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

const BUILD_DIRECTIVE_ISSUE = /must use a braced expression|cannot use a braced loop expression/

function collectDirectiveDiagnostics(html: string): AeroDiagnostic[] {
	const diagnostics: AeroDiagnostic[] = []
	checkDirectiveExpressionBraces(makeDoc(html), html, diagnostics)
	return diagnostics
}

describe('directive parity — vscode surface', () => {
	for (const scenario of DIRECTIVE_PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.vscode
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			const diagnostics = collectDirectiveDiagnostics(scenario.html)
			const buildDiags = diagnostics.filter(d => BUILD_DIRECTIVE_ISSUE.test(d.message))

			if (expectation.outcome === 'pass') {
				expect(buildDiags).toEqual([])
				return
			}

			expect(buildDiags.length).toBeGreaterThan(0)
			if (expectation.messageIncludes) {
				expect(buildDiags.some(d => d.message.includes(expectation.messageIncludes!))).toBe(true)
			}
			if (expectation.code) {
				const match = buildDiags.find(d => d.code === expectation.code)
				expect(match).toBeDefined()
			}
		})
	}
})
