/**
 * VS Code surface parity — uses full collectTemplateDiagnostics (same path as Problems).
 * Partial feature-gates + directive-braces-only harness retired.
 */

import { PARITY_SCENARIOS } from '../../../diagnostics/src/__tests__/fixtures/parity/index.js'
import { describe, expect, it } from 'vitest'
import { collectTemplateDiagnostics } from '@aero-js/core/template-diagnostics'
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
		offsetAt: (position: { line: number; character: number }) => {
			const lines = text.split('\n')
			let offset = 0
			for (let i = 0; i < position.line; i++) {
				offset += (lines[i]?.length ?? 0) + 1
			}
			return offset + position.character
		},
	}
}

describe('diagnostics parity — vscode/ide surface', () => {
	for (const scenario of PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.ide ?? scenario.surfaces.vscode
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			const diagnostics = collectTemplateDiagnostics({
				document: makeDoc(scenario.html, '/tmp/client/pages/index.html'),
				root: '/tmp',
				flags: scenario.flags,
			})

			const match =
				diagnostics.find(d => d.message.includes(expectation.messageIncludes)) ??
				diagnostics.find(d => d.code === expectation.code)
			expect(match).toBeDefined()
			expect(match!.message).toContain(expectation.messageIncludes)
			expect(match!.code).toBe(expectation.code)
		})
	}
})
