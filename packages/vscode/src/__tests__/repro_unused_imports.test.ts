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

describe('Reproduction: Unused imports from aero:content', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should NOT flag getCollection when used in getStaticPaths', () => {
		const text = `
<script on:build>
    import { getCollection } from 'aero:content'
    
    export async function getStaticPaths() {
        const posts = await getCollection('posts')
        return posts.map(post => ({ params: { slug: post.slug } }))
    }
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

		const reportedDiagnostics = mockSet.mock.calls[0][1]
		const unusedDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'getCollection' is declared but its value is never read"),
		)
		expect(unusedDiag).toBeUndefined()
	})

	it('should NOT flag render when used in getStaticPaths', () => {
		const text = `
<script on:build>
    import { getCollection, render } from 'aero:content'
    
    export async function getStaticPaths() {
        const posts = await getCollection('posts')
        return posts.map(post => {
            const content = render(post)
            return { params: { slug: post.slug }, props: { content } }
        })
    }
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

		const reportedDiagnostics = mockSet.mock.calls[0][1]
		const unusedRenderDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'render' is declared but its value is never read"),
		)
		// Check for both just in case
		const unusedCollectionDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'getCollection' is declared but its value is never read"),
		)

		expect(unusedRenderDiag).toBeUndefined()
		expect(unusedCollectionDiag).toBeUndefined()
	})
})
