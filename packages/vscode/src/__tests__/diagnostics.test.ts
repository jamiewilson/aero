import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks
const mockSet = vi.fn()
const mockCollection = {
	set: mockSet,
	delete: vi.fn(),
	dispose: vi.fn(),
}

vi.mock('vscode', () => {
	return {
		Range: class {
			start: any
			end: any
			constructor(start: any, end: any) {
				this.start = start
				this.end = end
			}
		},
		Position: class {
			line: any
			character: any
			constructor(line: any, character: any) {
				this.line = line
				this.character = character
			}
		},
		Diagnostic: class {
			range: any
			message: any
			severity: any
			tags: any[]
			constructor(range: any, message: any, severity: any) {
				this.range = range
				this.message = message
				this.severity = severity
				this.tags = []
			}
		},
		DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
		DiagnosticTag: { Unnecessary: 1 },
		workspace: {
			onDidOpenTextDocument: vi.fn(),
			onDidSaveTextDocument: vi.fn(),
			onDidChangeTextDocument: vi.fn(),
			onDidCloseTextDocument: vi.fn(),
			textDocuments: [],
			getWorkspaceFolder: vi.fn(),
			getConfiguration: () => ({ get: () => 'always' }),
		},
		languages: {
			createDiagnosticCollection: () => mockCollection,
		},
		Uri: { parse: (s: string) => ({ toString: () => s, fsPath: s, scheme: 'file' }) },
	}
})

import { AeroDiagnostics } from '../diagnostics'

describe('AeroDiagnostics Unused Variables', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should flag unused component import even if name exists in import path', () => {
		const text = `
<script on:build>
    import header from './header'
    // header is NOT used in template
</script>
<div></div>
`
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html', scheme: 'file' },
			getText: () => text,
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			languageId: 'html',
			fileName: '/test.html',
			lineAt: (line: number) => ({ text: text.split('\n')[line] }),
		} as any

		const context = { subscriptions: [] } as any
		const diagnostics = new AeroDiagnostics(context)
		;(diagnostics as any).updateDiagnostics(doc)

		expect(mockSet).toHaveBeenCalled()
		const reportedDiagnostics = mockSet.mock.calls[0][1]

		const unusedHeaderDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'header' is declared but its value is never read"),
		)

		expect(unusedHeaderDiag).toBeDefined()
	})

	it('should NOT flag used component import', () => {
		const text = `
<script on:build>
    import header from './header'
</script>
<header-component />
`
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html', scheme: 'file' },
			getText: () => text,
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			languageId: 'html',
			fileName: '/test.html',
		} as any

		const context = { subscriptions: [] } as any
		const diagnostics = new AeroDiagnostics(context)
		;(diagnostics as any).updateDiagnostics(doc)

		const reportedDiagnostics = mockSet.mock.calls[0][1]
		const unusedHeaderDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'header' is declared but its value is never read"),
		)
		expect(unusedHeaderDiag).toBeUndefined()
	})

	it('should NOT flag imports from on:build as unused when an on:client block is also present', () => {
		// The real issue: with two script blocks, each block was checked independently.
		// Imports in on:build would appear 0 times in on:client content → false unused.
		const text = `
<script on:build>
  import base from '@layouts/base'
  import { render } from 'aero:content'
  const doc = Aero.props
  const { html } = await render(doc)
</script>
<base-layout title="{doc.data.title}">
  <section>{html}</section>
</base-layout>
<script on:client>
  console.log('client side')
</script>
`
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html', scheme: 'file' },
			getText: () => text,
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			languageId: 'html',
			fileName: '/test.html',
			lineAt: (line: number) => ({ text: text.split('\n')[line] }),
		} as any

		const context = { subscriptions: [] } as any
		const diagnostics = new AeroDiagnostics(context)
		;(diagnostics as any).updateDiagnostics(doc)

		const reportedDiagnostics = mockSet.mock.calls[0][1]
		const unusedDiags = reportedDiagnostics.filter((d: any) =>
			d.message.includes('is declared but its value is never read'),
		)
		// render is used inside on:build (render(doc)) — should NOT be flagged
		// base is used as <base-layout> in template — should NOT be flagged
		// doc/html are used in template expressions
		expect(unusedDiags).toHaveLength(0)
	})

	it('should flag on:build import as unused even if the same name is declared in on:client', () => {
		// on:client is browser-only — a `const base = ...` there must NOT count as usage
		// of the `import base` in on:build.
		const text = `
<script on:build>
  import base from '@layouts/base'
</script>
<div>no template usage of base</div>
<script on:client>
  const base = 'test' // same name, different scope — must not satisfy on:build import
  console.log(base)
</script>
`
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html', scheme: 'file' },
			getText: () => text,
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			languageId: 'html',
			fileName: '/test.html',
			lineAt: (line: number) => ({ text: text.split('\n')[line] }),
		} as any

		const context = { subscriptions: [] } as any
		const diagnostics = new AeroDiagnostics(context)
		;(diagnostics as any).updateDiagnostics(doc)

		const reportedDiagnostics = mockSet.mock.calls[0][1]
		const unusedBaseDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'base' is declared but its value is never read"),
		)
		expect(unusedBaseDiag).toBeDefined()
	})

	it('should NOT flag variable as unused when used in Alpine x-data attribute', () => {
		const text = `
<script on:build>
	const dismiss = el => setTimeout(() => el.replaceChildren(), 3000)
</script>
<section x-data="{input: '', dismiss: dismiss}">
	<span @click="dismiss($el)">Click me</span>
</section>
`
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html', scheme: 'file' },
			getText: () => text,
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			languageId: 'html',
			fileName: '/test.html',
			lineAt: (line: number) => ({ text: text.split('\n')[line] }),
		} as any

		const context = { subscriptions: [] } as any
		const diagnostics = new AeroDiagnostics(context)
		;(diagnostics as any).updateDiagnostics(doc)

		const reportedDiagnostics = mockSet.mock.calls[0][1]
		const unusedDismissDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'dismiss' is declared but its value is never read"),
		)
		expect(unusedDismissDiag).toBeUndefined()
	})

	it('should NOT flag variable as unused when used in HTMX event handler', () => {
		const text = `
<script on:build>
	const dismiss = el => setTimeout(() => el.replaceChildren(), 3000)
</script>
<span @htmx:after-swap="dismiss($el)"></span>
`
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html', scheme: 'file' },
			getText: () => text,
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			languageId: 'html',
			fileName: '/test.html',
			lineAt: (line: number) => ({ text: text.split('\n')[line] }),
		} as any

		const context = { subscriptions: [] } as any
		const diagnostics = new AeroDiagnostics(context)
		;(diagnostics as any).updateDiagnostics(doc)

		const reportedDiagnostics = mockSet.mock.calls[0][1]
		const unusedDismissDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'dismiss' is declared but its value is never read"),
		)
		expect(unusedDismissDiag).toBeUndefined()
	})
})
