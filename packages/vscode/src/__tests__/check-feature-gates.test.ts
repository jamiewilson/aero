/**
 * Feature gate diagnostics: is:state requires reactivity; monorepo project-root resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import { checkFeatureGates } from '../diagnostics/check-feature-gates'

const repoRoot = '/Users/jamie/dev/aero'
const kitchenSinkRoot = `${repoRoot}/examples/kitchen-sink`
const counterPath = `${kitchenSinkRoot}/client/pages/counter.html`

const counterText = `<script is:build>
	import base from '@layouts/base'
</script>

<script is:state>
	let count = 0
</script>

<base-layout title="Reactivity Demo">
	<p>Count: <strong>{ count }</strong></p>
</base-layout>
`

vi.mock('vscode', () => ({
	Diagnostic: class {
		range: unknown
		message: string
		severity: unknown
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
	Uri: {
		parse: (s: string) => ({ toString: () => s }),
	},
	workspace: {
		getWorkspaceFolder: vi.fn(),
	},
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

describe('checkFeatureGates', () => {
	beforeEach(() => {
		vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
			uri: { fsPath: repoRoot },
		} as vscode.WorkspaceFolder)
	})

	it('does not report when reactivity is enabled in nested monorepo app', () => {
		const diagnostics: vscode.Diagnostic[] = []
		checkFeatureGates(makeDoc(counterText, counterPath), counterText, diagnostics)

		const reactivityDiag = diagnostics.find(d =>
			d.message.includes('`<script is:state>` requires `reactivity: true`')
		)
		expect(reactivityDiag).toBeUndefined()
	})

	it('points is:state diagnostic at the script tag, not document start', () => {
		vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue({
			uri: { fsPath: '/tmp/no-config-root' },
		} as vscode.WorkspaceFolder)

		const diagnostics: vscode.Diagnostic[] = []
		checkFeatureGates(makeDoc(counterText, '/tmp/no-config-root/page.html'), counterText, diagnostics)

		const reactivityDiag = diagnostics.find(d =>
			d.message.includes('`<script is:state>` requires `reactivity: true`')
		)
		expect(reactivityDiag).toBeDefined()
		const range = reactivityDiag!.range as { start: { line: number; character: number } }
		expect(range.start.line).toBeGreaterThan(0)
		expect(counterText.slice(0, 50)).toContain('is:build')
		expect(counterText.split('\n')[range.start.line]).toMatch(/is:state/)
	})
})
