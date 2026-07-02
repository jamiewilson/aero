import { DIRECTIVE_PARITY_SCENARIOS } from '@aero-js/diagnostics/parity'
import { describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { checkDirectiveExpressionBraces } from '../diagnostics/check-directive-braces'

vi.mock('vscode', () => ({
	Diagnostic: class {
		range: unknown
		message: string
		severity: unknown
		code?: { value: string }
		constructor(range: unknown, message: string, severity: unknown) {
			this.range = range
			this.message = message
			this.severity = severity
		}
	},
	DiagnosticSeverity: { Error: 0 },
	Range: class {
		start: unknown
		end: unknown
		constructor(start: unknown, end?: unknown, endLine?: number, endChar?: number) {
			if (typeof start === 'object' && start !== null && 'line' in start) {
				this.start = start
				this.end = end
				return
			}
			this.start = { line: start, character: end }
			this.end = { line: endLine, character: endChar }
		}
	},
	Uri: { parse: (s: string) => ({ toString: () => s }) },
}))

function makeDoc(text: string) {
	return {
		uri: { toString: () => 'file:///test.html', fsPath: '/test.html', scheme: 'file' },
		getText: () => text,
		positionAt: (offset: number) => {
			const lines = text.slice(0, offset).split('\n')
			return {
				line: lines.length - 1,
				character: lines[lines.length - 1]?.length ?? 0,
			}
		},
		languageId: 'html',
		fileName: '/test.html',
	} as unknown as vscode.TextDocument
}

const BRACED_EXPR_MESSAGE = 'must use a braced expression'

function collectDirectiveBraceDiagnostics(html: string): vscode.Diagnostic[] {
	const diagnostics: vscode.Diagnostic[] = []
	checkDirectiveExpressionBraces(makeDoc(html), html, diagnostics)
	return diagnostics
}

describe('directive parity — vscode surface', () => {
	for (const scenario of DIRECTIVE_PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.vscode
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			const diagnostics = collectDirectiveBraceDiagnostics(scenario.html)
			const braceDiags = diagnostics.filter(d => d.message.includes(BRACED_EXPR_MESSAGE))

			if (expectation.outcome === 'pass') {
				expect(braceDiags, scenario.knownGap ?? 'expected no braced-expression diagnostics').toEqual(
					[]
				)
				return
			}

			expect(braceDiags.length).toBeGreaterThan(0)
			if (expectation.messageIncludes) {
				expect(braceDiags.some(d => d.message.includes(expectation.messageIncludes!))).toBe(true)
			}
			if (expectation.code) {
				const match = braceDiags.find(
					d =>
						typeof d.code === 'object' &&
						d.code &&
						'value' in d.code &&
						d.code.value === expectation.code
				)
				expect(match).toBeDefined()
			}
		})
	}
})
