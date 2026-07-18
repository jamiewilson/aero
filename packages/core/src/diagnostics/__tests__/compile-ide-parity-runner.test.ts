/**
 * One parity runner: compile + full collectTemplateDiagnostics adapters.
 */

import { compile, parse } from '@aero-js/compiler'
import { normalizeToDiagnostics, type AeroDiagnostic } from '@aero-js/diagnostics'
import { PARITY_SCENARIOS, type ParityExpectation } from '../../../../diagnostics/src/__tests__/fixtures/parity/index.js'
import { describe, expect, it } from 'vitest'
import { collectTemplateDiagnostics } from '../../template-diagnostics'
import type { SourceDocument } from '../../template-diagnostics/source-document'

const mockOptions = {
	root: '/',
	resolvePath: (v: string) => v,
	importer: '/tmp/client/pages/index.html',
}

function makeDocument(text: string, fsPath: string): SourceDocument {
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

function compileDiagnostics(
	html: string,
	flags: { reactivity: boolean; hypermedia: boolean }
): AeroDiagnostic[] {
	try {
		compile(parse(html), {
			...mockOptions,
			reactivity: flags.reactivity,
			hypermedia: flags.hypermedia,
			diagnosticTemplateSource: html,
		})
		return []
	} catch (error) {
		return normalizeToDiagnostics(error)
	}
}

function ideDiagnostics(
	html: string,
	flags: { reactivity: boolean; hypermedia: boolean }
): AeroDiagnostic[] {
	return collectTemplateDiagnostics({
		document: makeDocument(html, mockOptions.importer),
		root: '/tmp',
		flags,
	})
}

function expectMatch(diagnostics: AeroDiagnostic[], expectation: ParityExpectation): void {
	const match =
		diagnostics.find(d => d.message.includes(expectation.messageIncludes)) ??
		diagnostics.find(d => d.code === expectation.code)
	expect(match, `expected diagnostic containing ${expectation.messageIncludes}`).toBeDefined()
	expect(match!.message).toContain(expectation.messageIncludes)
	expect(match!.code).toBe(expectation.code)
	if (expectation.severity) {
		expect(match!.severity).toBe(expectation.severity)
	}
}

describe('compile ↔ ide parity runner', () => {
	for (const scenario of PARITY_SCENARIOS) {
		const compileExpect = scenario.surfaces.compiler
		const ideExpect = scenario.surfaces.ide ?? scenario.surfaces.vscode

		if (compileExpect) {
			it(`${scenario.id} [compile]: ${scenario.description}`, () => {
				expectMatch(compileDiagnostics(scenario.html, scenario.flags), compileExpect)
			})
		}

		if (ideExpect) {
			it(`${scenario.id} [ide]: ${scenario.description}`, () => {
				expectMatch(ideDiagnostics(scenario.html, scenario.flags), ideExpect)
			})
		}

		if (compileExpect && ideExpect) {
			it(`${scenario.id} [both]: code and message agree`, () => {
				const fromCompile = compileDiagnostics(scenario.html, scenario.flags)
				const fromIde = ideDiagnostics(scenario.html, scenario.flags)
				expectMatch(fromCompile, compileExpect)
				expectMatch(fromIde, ideExpect)
				expect(compileExpect.code).toBe(ideExpect.code)
			})
		}
	}
})
