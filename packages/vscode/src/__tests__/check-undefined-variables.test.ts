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
import {
	checkUndefinedVariables,
	hasStateScript,
} from '../diagnostics/check-undefined-variables'

function makeDoc(text: string) {
	return {
		uri: { fsPath: '/counter.html', scheme: 'file' },
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

describe('checkUndefinedVariables state scope', () => {
	it('detects is:state scripts for targeted template undefined checks', () => {
		const text = `<script is:state>let count = 0</script><p>{ count }</p>`
		const parsed = parseDocument(makeDoc(text))
		expect(hasStateScript(parsed)).toBe(true)
	})

	it('flags handler refs missing from is:state bindings', () => {
		const text = `<script is:state>
	let count = 0
	//const inc = () => count++
</script>
<button on:click="{ inc() }">+</button>
<p>{ count }</p>
`
		const parsed = parseDocument(makeDoc(text))
		const diagnostics: any[] = []
		checkUndefinedVariables(parsed, diagnostics)

		expect(diagnostics.find(d => d.message.includes("'inc' is not defined"))).toBeDefined()
		expect(diagnostics.find(d => d.message.includes("'count' is not defined"))).toBeUndefined()
	})
})
