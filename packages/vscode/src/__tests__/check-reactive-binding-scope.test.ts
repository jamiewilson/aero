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
	DiagnosticSeverity: { Warning: 1, Error: 0 },
	Range: class {
		start: unknown
		end: unknown
		constructor(start: unknown, end: unknown) {
			this.start = start
			this.end = end
		}
	},
	Uri: { parse: (s: string) => ({ toString: () => s }) },
}))

import { parseDocument } from '../document-analysis'
import { checkReactiveBindingScope } from '../../../core/src/template-diagnostics/checks/check-reactive-binding-scope'

function makeDoc(text: string) {
	return {
		uri: { fsPath: '/bindings.html', scheme: 'file' },
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

describe('checkReactiveBindingScope', () => {
	it('errors when show references a build-time variable with is:state present', () => {
		const text = `<script is:build>
	let open = false
</script>
<script is:state>
	let active = false
</script>
<div show="{ open }"></div>`
		const doc = makeDoc(text)
		const parsed = parseDocument(doc)
		const diagnostics: any[] = []
		checkReactiveBindingScope(doc, parsed, diagnostics)

		expect(diagnostics).toHaveLength(1)
		expect(diagnostics[0].message).toContain('`show` binding must reference a declared state variable')
		expect(diagnostics[0].severity).toBe('error')
		const openOffset = text.indexOf('open', text.indexOf('show'))
		expect(diagnostics[0].span?.line).toBe(doc.positionAt(openOffset).line)
		expect(diagnostics[0].span?.column).toBe(doc.positionAt(openOffset).character)
	})

	it('errors when html references a build-time variable with is:state present', () => {
		const text = `<script is:build>
	const title = 'x'
</script>
<script is:state>
	let count = 0
</script>
<div html="{ title }"></div>`
		const parsed = parseDocument(makeDoc(text))
		const diagnostics: any[] = []
		checkReactiveBindingScope(makeDoc(text), parsed, diagnostics)

		expect(diagnostics).toHaveLength(1)
		expect(diagnostics[0].message).toContain('`html` binding must reference a declared state variable')
	})

	it('does not error when show references a state variable', () => {
		const text = `<script is:build>
	let open = false
</script>
<script is:state>
	let open = true
</script>
<div show="{ open }"></div>`
		const parsed = parseDocument(makeDoc(text))
		const diagnostics: any[] = []
		checkReactiveBindingScope(makeDoc(text), parsed, diagnostics)
		expect(diagnostics).toHaveLength(0)
	})

	it('does not error without is:state (static build interpolation)', () => {
		const text = `<script is:build>
	let open = true
</script>
<div show="{ open }"></div>`
		const parsed = parseDocument(makeDoc(text))
		const diagnostics: any[] = []
		checkReactiveBindingScope(makeDoc(text), parsed, diagnostics)
		expect(diagnostics).toHaveLength(0)
	})

	it('does not error when expression references only state bindings', () => {
		const text = `<script is:state>
	let active = false
</script>
<button class:is-active="{ active }">x</button>`
		const parsed = parseDocument(makeDoc(text))
		const diagnostics: any[] = []
		checkReactiveBindingScope(makeDoc(text), parsed, diagnostics)
		expect(diagnostics).toHaveLength(0)
	})
})
