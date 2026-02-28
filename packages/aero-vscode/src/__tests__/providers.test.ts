/**
 * Unit tests for VS Code language providers: AeroCompletionProvider, AeroHoverProvider,
 * AeroDefinitionProvider. Mocks vscode (Range, Position, workspace, languages, etc.),
 * pathResolver (getResolver), and scope (isAeroDocument, getScopeMode). Asserts completion
 * items, hover null for non-Aero docs, and definition locations for content globals and components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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
			getWorkspaceFolder: vi.fn(() => ({ uri: { fsPath: '/workspace' } })),
			getConfiguration: () => ({ get: () => 'always' }),
		},
		languages: {
			createDiagnosticCollection: () => mockCollection,
			registerDefinitionProvider: vi.fn(),
			registerCompletionItemProvider: vi.fn(),
			registerHoverProvider: vi.fn(),
		},
		Uri: { 
			parse: (s: string) => ({ toString: () => s, fsPath: s, scheme: 'file' }),
			file: (s: string) => ({ fsPath: s, scheme: 'file' }),
		},
		CompletionItem: class {
			label: string
			kind: number
			constructor(label: string, kind: number) {
				this.label = label
				this.kind = kind
			}
		},
		CompletionItemKind: {
			Property: 6,
			Keyword: 13,
			Class: 6,
			Struct: 22,
			Folder: 17,
			File: 1,
			Module: 8,
			Variable: 5,
		},
		SnippetString: class {
			value: string
			constructor(value: string) {
				this.value = value
			}
		},
		MarkdownString: class {
			value: string
			constructor(value?: string) {
				this.value = value || ''
			}
			appendMarkdown(val: string) {
				this.value += val
			}
			appendCodeblock(val: string, lang?: string) {
				this.value += '```' + (lang || '') + '\n' + val + '\n```\n'
			}
		},
	}
})

vi.mock('../pathResolver', () => ({
	getResolver: vi.fn(() => ({
		root: '/workspace',
		resolve: vi.fn((specifier: string) => {
			if (specifier.startsWith('@components/')) {
				return '/workspace/client/components/' + specifier.replace('@components/', '') + '.html'
			}
			if (specifier.startsWith('@layouts/')) {
				return '/workspace/client/layouts/' + specifier.replace('@layouts/', '') + '.html'
			}
			if (specifier.startsWith('@content/')) {
				return '/workspace/client/content/' + specifier.replace('@content/', '') + '.ts'
			}
			return '/workspace/' + specifier
		}),
	})),
	clearResolverCache: vi.fn(),
}))

vi.mock('../scope', () => ({
	isAeroDocument: vi.fn(() => true),
	getScopeMode: vi.fn(() => 'auto'),
	clearScopeCache: vi.fn(),
}))

import { AeroCompletionProvider } from '../completionProvider'
import { AeroHoverProvider } from '../hoverProvider'
import { AeroDefinitionProvider } from '../definitionProvider'

/** Completions: after < (tags), inside tag (attrs), inside { } (content globals), import paths. */
describe('AeroCompletionProvider', () => {
	let provider: AeroCompletionProvider

	beforeEach(() => {
		vi.clearAllMocks()
		provider = new AeroCompletionProvider()
	})

	it('should provide component tag completions after <', async () => {
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => '<',
			lineAt: (line: number) => ({ text: '<' }),
		} as any

		const position = { line: 0, character: 1 } as any
		const context = { triggerCharacter: '<', isIncomplete: false } as any

		const result = provider.provideCompletionItems(doc, position, {} as any, context)
		
		expect(result).not.toBeNull()
	})

	it('should provide attribute completions inside a tag', async () => {
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => '<div ',
			lineAt: (line: number) => ({ text: '<div ' }),
		} as any

		const position = { line: 0, character: 5 } as any
		const context = {} as any

		const result = provider.provideCompletionItems(doc, position, {} as any, context)
		
		expect(result).not.toBeNull()
	})

	it('should provide content global completions inside expression', async () => {
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => '<div>{',
			lineAt: (line: number) => ({ text: '<div>{|' }),
		} as any

		const position = { line: 0, character: 6 } as any
		const context = {} as any

		const result = provider.provideCompletionItems(doc, position, {} as any, context)
		
		expect(result).not.toBeNull()
		const items = result as any[]
		const labels = items.map((i: any) => i.label)
		expect(labels).toContain('site')
		expect(labels).toContain('theme')
	})

	it('should provide import path completions', async () => {
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => "import foo from '@components",
			lineAt: (line: number) => ({ text: "import foo from '@components" }),
		} as any

		const position = { line: 0, character: 17 } as any // after '@components'

		const result = provider.provideCompletionItems(doc, position, {} as any, {} as any)
		
		expect(result).not.toBeNull()
	})
})

/** Hover: returns null when isAeroDocument is false; otherwise hover content for symbols. */
describe('AeroHoverProvider', () => {
	let provider: AeroHoverProvider

	beforeEach(() => {
		vi.clearAllMocks()
		provider = new AeroHoverProvider()
	})

	it('should return null for non-Aero documents', async () => {
		const { isAeroDocument } = await import('../scope')
		;(isAeroDocument as any).mockReturnValueOnce(false)

		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => '<div></div>',
			lineAt: (line: number) => ({ text: '<div></div>' }),
			positionAt: (offset: number) => ({ line: 0, character: offset }),
		} as any

		const position = { line: 0, character: 2 } as any
		const result = await provider.provideHover(doc, position, {} as any)
		
		expect(result).toBeNull()
	})
})

/** Go-to-definition: null for non-Aero docs; content global (site) and component tags resolve to file locations. */
describe('AeroDefinitionProvider', () => {
	let provider: AeroDefinitionProvider

	beforeEach(() => {
		vi.clearAllMocks()
		provider = new AeroDefinitionProvider()
	})

	it('should return null for non-Aero documents', async () => {
		const { isAeroDocument } = await import('../scope')
		;(isAeroDocument as any).mockReturnValueOnce(false)

		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => '<div></div>',
			lineAt: (line: number) => ({ text: '<div></div>' }),
			positionAt: (offset: number) => ({ line: 0, character: offset }),
		} as any

		const position = { line: 0, character: 2 } as any
		const result = await provider.provideDefinition(doc, position, {} as any)
		
		expect(result).toBeNull()
	})

	it('should provide definition for content global', async () => {
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => '<div>{site.title}</div>',
			lineAt: (line: number) => ({ text: '<div>{site.title}</div>' }),
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			offsetAt: (pos: any) => pos.character,
		} as any

		const position = { line: 0, character: 7 } as any // on 'site'
		const result = await provider.provideDefinition(doc, position, {} as any)
		
		expect(result).not.toBeNull()
		expect(result?.length).toBeGreaterThan(0)
	})

	it('should provide definition for component tag', async () => {
		const doc = {
			uri: { toString: () => 'file:///test.html', fsPath: '/test.html' },
			getText: () => '<header-component></header-component>',
			lineAt: (line: number) => ({ text: '<header-component></header-component>' }),
			positionAt: (offset: number) => ({ line: 0, character: offset }),
			offsetAt: (pos: any) => pos.character,
		} as any

		const position = { line: 0, character: 1 } as any // on 'header'
		const result = await provider.provideDefinition(doc, position, {} as any)
		
		expect(result).not.toBeNull()
		expect(result?.length).toBeGreaterThan(0)
	})
})
