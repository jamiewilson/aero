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
		constructor(start: unknown, end: unknown) {
			this.start = start
			this.end = end
		}
	},
	Uri: { parse: (s: string) => ({ toString: () => s }) },
	workspace: {
		getConfiguration: () => ({
			get: () => false,
		}),
		getWorkspaceFolder: () => undefined,
	},
}))

import { parseDocument } from '../document-analysis'
import {
	checkUndefinedVariables,
	hasBuildScript,
	hasStateScript,
} from '../../../core/src/template-diagnostics/checks/check-undefined-variables'

function makeDoc(text: string) {
	return {
		uri: { fsPath: '/footer.html', scheme: 'file' },
		fileName: '/footer.html',
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

const footerLike = `<script is:build>
	import site from '@content/site.ts'
	//const links = site.footer.links
</script>

<footer>
	<menu>
		<template for="{ const { path } of links }">
			<a href="{ path }"> { label } </a>
		</template>
	</menu>
</footer>`

describe('for-loop undefined diagnostics (build-only templates)', () => {
	it('detects build script without is:state', () => {
		const parsed = parseDocument(makeDoc(footerLike))
		expect(hasStateScript(parsed)).toBe(false)
		expect(hasBuildScript(parsed)).toBe(true)
	})

	it('flags undefined links iterable and label binding', () => {
		const doc = makeDoc(footerLike)
		const parsed = parseDocument(doc)
		const diagnostics: any[] = []
		checkUndefinedVariables(doc, parsed, diagnostics)
		const messages = diagnostics.map((d: { message: string }) => d.message)
		expect(messages.some(m => m.includes("'links' is not defined"))).toBe(true)
		expect(messages.some(m => m.includes("'label' is not defined"))).toBe(true)
	})

	it('does not flag when links is defined and label is destructured', () => {
		const text = `<script is:build>
	const links = [{ path: '/', label: 'Home' }]
</script>
<template for="{ const { path, label } of links }">
	<a href="{ path }">{ label }</a>
</template>`
		const doc = makeDoc(text)
		const parsed = parseDocument(doc)
		const diagnostics: any[] = []
		checkUndefinedVariables(doc, parsed, diagnostics)
		const undefinedMsgs = diagnostics
			.map((d: { message: string }) => d.message)
			.filter(m => m.includes('is not defined') && m.includes('Variable'))
		expect(undefinedMsgs).toHaveLength(0)
	})
})
