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
<script is:build>
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
<script is:build>
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

	it('should NOT flag imports from is:build as unused when an is:bundled block is also present', () => {
		// The real issue: with two script blocks, each block was checked independently.
		// Imports in is:build would appear 0 times in is:bundled content → false unused.
		const text = `
<script is:build>
  import base from '@layouts/base'
  import { render } from 'aero:content'
  const doc = Aero.props
  const { html } = await render(doc)
</script>
<base-layout title="{doc.data.title}">
  <section>{html}</section>
</base-layout>
<script is:bundled>
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
		// render is used inside is:build (render(doc)) — should NOT be flagged
		// base is used as <base-layout> in template — should NOT be flagged
		// doc/html are used in template expressions
		expect(unusedDiags).toHaveLength(0)
	})

	it('should flag is:build import as unused even if the same name is declared in is:bundled', () => {
		// is:bundled is browser-only — a `const base = ...` there must NOT count as usage
		// of the `import base` in is:build.
		const text = `
<script is:build>
  import base from '@layouts/base'
</script>
<div>no template usage of base</div>
<script is:bundled>
  const base = 'test' // same name, different scope — must not satisfy is:build import
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
<script is:build>
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
<script is:build>
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

	it('should NOT flag getCollection when used in getStaticPaths', () => {
		const text = `
<script is:build>
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
<script is:build>
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
		const unusedCollectionDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'getCollection' is declared but its value is never read"),
		)

		expect(unusedRenderDiag).toBeUndefined()
		expect(unusedCollectionDiag).toBeUndefined()
	})
})

describe('AeroDiagnostics Undefined Variables', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should flag undefined variable in template expression', () => {
		const text = `
<div>{undefinedVar}</div>
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
		const undefinedDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'undefinedVar' is not defined"),
		)
		expect(undefinedDiag).toBeDefined()
	})

	it('should NOT flag defined variable in template expression', () => {
		const text = `
<script is:build>
	const myVar = 'hello'
</script>
<div>{myVar}</div>
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
		const undefinedDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'myVar' is not defined"),
		)
		expect(undefinedDiag).toBeUndefined()
	})

	it('should NOT flag content globals as undefined', () => {
		const text = `
<div>{site.title}</div>
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
		const undefinedDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'site' is not defined"),
		)
		expect(undefinedDiag).toBeUndefined()
	})

	it('should NOT flag undefined variable in Alpine x-data', () => {
		const text = `
<section x-data="{ input: '' }">
	<input x-model="input" />
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
		const undefinedDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes("'input' is not defined"),
		)
		expect(undefinedDiag).toBeUndefined()
	})
})

describe('AeroDiagnostics Script Tags', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should NOT warn when plain script tag (no attribute) — bundled as module by default', () => {
		const text = `
<script>
	const foo = 'bar'
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
		const scriptDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('<script> without attribute'),
		)
		expect(scriptDiag).toBeUndefined()
	})

	it('should NOT warn when script has is:build', () => {
		const text = `
<script is:build>
	const foo = 'bar'
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
		const scriptDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes(
				'Inline <script> should have is:build, is:bundled, or is:inline attribute',
			),
		)
		expect(scriptDiag).toBeUndefined()
	})

	it('should NOT warn when script has is:bundled', () => {
		const text = `
<script is:bundled>
	console.log('hello')
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
		const scriptDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes(
				'Inline <script> should have is:build, is:bundled, or is:inline attribute',
			),
		)
		expect(scriptDiag).toBeUndefined()
	})

	it('should warn when is:inline script has import without type="module"', () => {
		const text = `
<script is:inline>
	import { foo } from 'bar'
	console.log(foo)
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
		const importDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('Imports in <script is:inline> require type="module"'),
		)
		expect(importDiag).toBeDefined()
	})

	it('should NOT warn when is:inline script has import WITH type="module"', () => {
		const text = `
<script is:inline type="module">
	import { foo } from 'bar'
	console.log(foo)
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
		const importDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('Imports in <script is:inline>'),
		)
		expect(importDiag).toBeUndefined()
	})

	it('should NOT warn when plain script has import — bundled as module by default', () => {
		const text = `
<script>
	import { foo } from 'bar'
	console.log(foo)
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
		const importDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('Imports in bundled scripts'),
		)
		expect(importDiag).toBeUndefined()
	})

	it('should NOT warn when pass:data script has import (Vite handles bundling)', () => {
		const text = `
<script pass:data="{ foo }">
	import { bar } from 'baz'
	console.log(bar)
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
		const importDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('Imports in bundled scripts'),
		)
		expect(importDiag).toBeUndefined()
	})

	it('should NOT warn when bundled script has import WITH type="module"', () => {
		const text = `
<script type="module">
	import { foo } from 'bar'
	console.log(foo)
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
		const importDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('Imports in bundled scripts'),
		)
		expect(importDiag).toBeUndefined()
	})

	it('should NOT flag scripts inside HTML comments', () => {
		const text = `
<!--<script>
	import { foo } from 'bar'
</script>-->
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
		// Should not flag duplicate imports from commented script
		const dupDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('declared multiple times'),
		)
		expect(dupDiag).toBeUndefined()
	})

	it('should NOT flag duplicate when commented script has same import as real script', () => {
		const text = `
<script is:build>
	import { allCaps } from '@scripts/utils'
</script>
<!--<script>
	import { allCaps } from '@scripts/utils'
</script>-->
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
		const dupDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('declared multiple times'),
		)
		expect(dupDiag).toBeUndefined()
	})

	it('should warn when is:inline has import in multi-script file structure', () => {
		const text = `
<script is:build>
	import base from '@layouts/base'
	import header from '@components/header'
</script>
<base-layout>
	<header-component />
</base-layout>
<script is:inline>
	console.log('first inline')
</script>
<script is:inline>
	import { allCaps } from '@scripts/utils'
	console.log(allCaps('test'))
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
		const importDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('Imports in <script is:inline>'),
		)
		expect(importDiag).toBeDefined()
	})
})

describe('AeroDiagnostics Conditional Chains', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should flag orphaned else-if without preceding if', () => {
		const text = `
<div>Before</div>
<div data-else-if="{condition}">Else If</div>
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
		const elseIfDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('else-if must follow an element with if or else-if'),
		)
		expect(elseIfDiag).toBeDefined()
	})

	it('should flag orphaned else without preceding if', () => {
		const text = `
<div>Before</div>
<div data-else>Else</div>
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
		const elseDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('else must follow an element with if or else-if'),
		)
		expect(elseDiag).toBeDefined()
	})

	it('should NOT flag valid if-else-if-else chain', () => {
		const text = `
<div data-if="{a}">A</div>
<div data-else-if="{b}">B</div>
<div data-else>C</div>
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
		const conditionalDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('must follow an element with if or else-if'),
		)
		expect(conditionalDiag).toBeUndefined()
	})
})

describe('AeroDiagnostics Directive Expression Braces', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should flag directive without braced expression', () => {
		const text = `
<div data-if="condition">Content</div>
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
		const directiveDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('must use a braced expression'),
		)
		expect(directiveDiag).toBeDefined()
	})

	it('should NOT flag directive with braced expression', () => {
		const text = `
<div data-if="{condition}">Content</div>
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
		const directiveDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('must use a braced expression'),
		)
		expect(directiveDiag).toBeUndefined()
	})
})

describe('AeroDiagnostics Duplicate Declarations', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should flag import conflicting with local declaration', () => {
		const text = `
<script is:build>
	import header from '@components/header'
	const header = { title: 'Test' }
</script>
<header-component />
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
		const dupDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('declared multiple times'),
		)
		expect(dupDiag).toBeDefined()
	})

	it('should NOT flag when no duplicate', () => {
		const text = `
<script is:build>
	import header from '@components/header'
	const props = { title: 'Test' }
</script>
<header-component />
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
		const dupDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('declared multiple times'),
		)
		expect(dupDiag).toBeUndefined()
	})
})

describe('AeroDiagnostics Component References', () => {
	beforeEach(() => {
		mockSet.mockClear()
	})

	it('should ignore components inside is:bundled scripts', () => {
		const text = `
<script is:bundled>
	const tag = "<header-component>"
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

		const reportedDiagnostics = mockSet.mock.calls[0][1] || []
		const componentDiag = reportedDiagnostics.find((d: any) =>
			d.message.includes('is not imported'),
		)
		expect(componentDiag).toBeUndefined()
	})
})
