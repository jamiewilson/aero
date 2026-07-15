/**
 * Unit tests for scope.ts and pathResolver.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFiles: Record<string, string> = {}

vi.mock('vscode', () => {
	return {
		workspace: {
			getWorkspaceFolder: vi.fn((uri: any) => {
				if (uri?.fsPath?.startsWith('/workspace')) {
					return { uri: { fsPath: '/workspace' } }
				}
				return undefined
			}),
			getConfiguration: vi.fn(() => ({ get: vi.fn(() => false) })),
		},
		Uri: {
			file: (s: string) => ({ fsPath: s, scheme: 'file' }),
		},
	}
})

vi.mock('node:fs', () => ({
	existsSync: vi.fn((filePath: string) => Object.prototype.hasOwnProperty.call(mockFiles, filePath)),
	readFileSync: vi.fn((filePath: string) => mockFiles[filePath] ?? ''),
}))

function setFile(path: string, content: string): void {
	mockFiles[path] = content
}

describe('scope', () => {
	beforeEach(() => {
		for (const key of Object.keys(mockFiles)) delete mockFiles[key]
		vi.clearAllMocks()
	})

	describe('isAeroDocument', () => {
		it('returns true for html documents in an Aero project', async () => {
			const { isAeroDocument } = await import('../scope')
			setFile('/workspace/package.json', '{"dependencies":{"@aero-js/core":"1.0.0"}}')

			expect(
				isAeroDocument({ languageId: 'html', uri: { scheme: 'file', fsPath: '/workspace/x.html' } } as any)
			).toBe(true)
			expect(
				isAeroDocument({ languageId: 'aero', uri: { scheme: 'file', fsPath: '/workspace/x.html' } } as any)
			).toBe(false)
			expect(
				isAeroDocument({ languageId: 'html', uri: { scheme: 'untitled', fsPath: '/x.html' } } as any)
			).toBe(false)
		})

		it('does not emit debug logs when provider gate returns false', async () => {
			const { isAeroDocument, setScopeDebugLogger } = await import('../scope')
			const log = vi.fn()
			setScopeDebugLogger(log)

			expect(
				isAeroDocument({ languageId: 'json', uri: { scheme: 'file', fsPath: '/x.html' } } as any)
			).toBe(false)
			expect(log).not.toHaveBeenCalled()
			setScopeDebugLogger(undefined)
		})
	})

	describe('project scope', () => {
		it('recognizes html files in a detected Aero project', async () => {
			setFile('/workspace/apps/site/vite.config.ts', "import { aero } from '@aero-js/core/vite'")
			const { isAeroDocument, clearScopeCache } = await import('../scope')
			clearScopeCache()

			const doc = {
				languageId: 'html',
				uri: { scheme: 'file', fsPath: '/workspace/apps/site/client/pages/index.html' },
			} as any

			expect(isAeroDocument(doc)).toBe(true)
		})

		it('does not recognize html files outside detected Aero projects', async () => {
			setFile('/workspace/apps/other/package.json', '{"name":"other"}')
			const { isAeroDocument, clearScopeCache } = await import('../scope')
			clearScopeCache()

			const doc = {
				languageId: 'html',
				uri: { scheme: 'file', fsPath: '/workspace/apps/other/client/pages/index.html' },
			} as any

			expect(isAeroDocument(doc)).toBe(false)
		})

		it('uses nearest project root candidate and stops there', async () => {
			setFile('/workspace/package.json', '{"dependencies":{"@aero-js/core":"1.0.0"}}')
			setFile('/workspace/apps/other/package.json', '{"name":"other"}')
			const { isAeroDocument, clearScopeCache } = await import('../scope')
			clearScopeCache()

			const doc = {
				languageId: 'html',
				uri: { scheme: 'file', fsPath: '/workspace/apps/other/client/pages/index.html' },
			} as any

			expect(isAeroDocument(doc)).toBe(false)
		})

		it('does not log for non-html documents when debug logger is set', async () => {
			const { isAeroDocument, setScopeDebugLogger, clearScopeCache } =
				await import('../scope')
			clearScopeCache()
			const log = vi.fn()
			setScopeDebugLogger(log)

			const doc = {
				languageId: 'json',
				uri: { scheme: 'file', fsPath: '/workspace/package.json' },
			} as any

			expect(isAeroDocument(doc)).toBe(false)
			expect(log).not.toHaveBeenCalled()
			setScopeDebugLogger(undefined)
		})
	})
})

describe('pathResolver', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('returns a resolver object with root and resolve method', async () => {
		const { getResolver, clearResolverCache } = await import('../pathResolver')
		clearResolverCache()

		const doc = {
			uri: { fsPath: '/workspace/test.html' },
		} as any

		const resolver = getResolver(doc)

		expect(resolver).toBeDefined()
		expect(resolver!.root).toBe('/workspace')
		expect(typeof resolver!.resolve).toBe('function')
	})

	it('exports clearResolverCache', async () => {
		const { clearResolverCache } = await import('../pathResolver')
		expect(typeof clearResolverCache).toBe('function')
	})
})
