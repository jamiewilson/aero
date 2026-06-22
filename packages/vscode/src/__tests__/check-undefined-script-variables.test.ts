import { describe, it, expect, vi } from 'vitest'

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
		constructor(start: unknown, end?: unknown) {
			this.start = start
			this.end = end
		}
	},
	Uri: { parse: (s: string) => ({ toString: () => s }) },
}))

import { parseDocument } from '../document-analysis'
import { checkUndefinedScriptVariables } from '../diagnostics/check-undefined-script-variables'

function makeDoc(text: string) {
	return {
		uri: { fsPath: '/about.html', scheme: 'file' },
		getText: () => text,
		positionAt: (offset: number) => {
			const lines = text.slice(0, offset).split('\n')
			return {
				line: lines.length - 1,
				character: lines[lines.length - 1]?.length ?? 0,
			}
		},
	} as any
}

describe('checkUndefinedScriptVariables', () => {
	it('does not flag function parameters in is:state scripts', () => {
		const text = `<script is:state>
	function syncAuthLink(event) {
		event.preventDefault()
	}
</script>
<a on:click="{ syncAuthLink(event) }">x</a>`
		const parsed = parseDocument(makeDoc(text))
		const diagnostics: any[] = []
		checkUndefinedScriptVariables(makeDoc(text), parsed, diagnostics)

		expect(diagnostics.find(d => d.message.includes("'event' is not defined"))).toBeUndefined()
	})
})
