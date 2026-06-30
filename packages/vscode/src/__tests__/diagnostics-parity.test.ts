import { PARITY_SCENARIOS } from '@aero-js/diagnostics/parity'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkFeatureGates } from '../diagnostics/check-feature-gates'
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
	workspace: { getWorkspaceFolder: vi.fn() },
}))

function makeDoc(text: string, fsPath: string) {
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
	} as unknown as vscode.TextDocument
}

function collectVscodeDiagnostics(
	root: string,
	html: string,
	filePath: string
): Array<{ code: string; message: string }> {
	vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
		uri: { fsPath: root },
	} as vscode.WorkspaceFolder)

	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(
		path.join(root, 'aero.config.mjs'),
		`export default { reactivity: ${String(html.includes('is:state') && html.includes('POST') ? true : false)}, hypermedia: false }\n`,
		'utf-8'
	)

	const diagnostics: vscode.Diagnostic[] = []
	const doc = makeDoc(html, filePath)
	checkFeatureGates(doc, html, diagnostics)
	checkDirectiveExpressionBraces(doc, html, diagnostics)
	return diagnostics.map(d => ({
		code: typeof d.code === 'object' && d.code && 'value' in d.code ? String(d.code.value) : '',
		message: d.message,
	}))
}

describe('diagnostics parity — vscode surface', () => {
	let root = ''

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-vscode-parity-'))
	})

	for (const scenario of PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.vscode
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			fs.writeFileSync(
				path.join(root, 'aero.config.mjs'),
				`export default { reactivity: ${scenario.flags.reactivity}, hypermedia: ${scenario.flags.hypermedia} }\n`,
				'utf-8'
			)
			vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
				uri: { fsPath: root },
			} as vscode.WorkspaceFolder)

			const diagnostics: vscode.Diagnostic[] = []
			const filePath = path.join(root, 'client/pages/index.html')
			const doc = makeDoc(scenario.html, filePath)
			checkFeatureGates(doc, scenario.html, diagnostics)
			if (scenario.id === 'malformed-props-braces') {
				checkDirectiveExpressionBraces(doc, scenario.html, diagnostics)
			}

			const match = diagnostics.find(
				d =>
					(typeof d.code === 'object' &&
						d.code &&
						'value' in d.code &&
						d.code.value === expectation.code) ||
					d.message.includes(expectation.messageIncludes)
			)
			expect(match).toBeDefined()
			expect(match!.message).toContain(expectation.messageIncludes)
			if (typeof match!.code === 'object' && match!.code && 'value' in match!.code) {
				expect(match!.code.value).toBe(expectation.code)
			}
		})
	}

	it('reports hypermedia action without hypermedia flag', () => {
		fs.writeFileSync(
			path.join(root, 'aero.config.mjs'),
			'export default { reactivity: true, hypermedia: false }\n',
			'utf-8'
		)
		const html = `<script is:state>
	let label = 'Items'
</script>
<button on:click="{ GET('/api/items') }">{ label }</button>`
		const diagnostics: vscode.Diagnostic[] = []
		const doc = makeDoc(html, path.join(root, 'page.html'))
		checkFeatureGates(doc, html, diagnostics)
		expect(diagnostics.some(d => d.message.includes('Hypermedia action calls require'))).toBe(true)
	})
})
