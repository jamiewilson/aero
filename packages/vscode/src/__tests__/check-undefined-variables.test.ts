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
} from '../../../core/src/template-diagnostics/checks/check-undefined-variables'

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
		const doc = makeDoc(text)
		const parsed = parseDocument(doc)
		const diagnostics: any[] = []
		checkUndefinedVariables(doc, parsed, diagnostics)

		expect(diagnostics.find(d => d.message.includes("'inc' is not defined"))).toBeDefined()
		expect(diagnostics.find(d => d.message.includes("'count' is not defined"))).toBeUndefined()
	})

	it('allows event in on:* handler expressions', () => {
		const text = `<script is:state>
function syncAuthLink(event) { event.preventDefault() }
</script>
<a on:click="{ syncAuthLink(event) }">x</a>`
		const doc = makeDoc(text)
		const parsed = parseDocument(doc)
		const diagnostics: any[] = []
		checkUndefinedVariables(doc, parsed, diagnostics)
		expect(diagnostics.find(d => d.message.includes("'event' is not defined"))).toBeUndefined()
	})

	it('allows hypermedia GET/POST in on:* handler expressions', () => {
		const text = `<script is:state>
	let status = 'Ready'
</script>
<button on:click="{ GET('/api/hypermedia-demo', { target: '#hypermedia-result' }) }">Load</button>
<button on:click="{ POST('/api/save', { state: 'status' }) }">Save</button>`
		const doc = makeDoc(text)
		const parsed = parseDocument(doc)
		const diagnostics: any[] = []
		checkUndefinedVariables(doc, parsed, diagnostics)
		for (const name of ['GET', 'POST']) {
			expect(diagnostics.find(d => d.message.includes(`'${name}' is not defined`))).toBeUndefined()
		}
	})
})
